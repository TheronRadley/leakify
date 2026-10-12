/**
 * Row Level Security + ownership regression suite.
 *
 * Runs the project's real migrations inside an in-memory Postgres (PGlite) and
 * exercises them as two different authenticated users, which is the scenario
 * the policies exist for (audit S-01). Everything here executes SQL — nothing
 * is asserted by reading the migration text.
 */
import {
  createTestDatabase,
  FK_VIOLATION,
  insertSubscription,
  RLS_VIOLATION,
  seedUsers,
  USER_A,
  USER_B,
  type TestDatabase,
} from '../harness';

const OWNED_TABLES = [
  'profiles',
  'subscriptions',
  'billing_events',
  'notification_preferences',
  'notification_records',
] as const;

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
  await seedUsers(db);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

/** Give both users one subscription each, as themselves. */
async function seedOwnedSubscriptions(): Promise<{ subA: string; subB: string }> {
  const subA = await db.asUser(USER_A, (tx) => insertSubscription(tx, USER_A, "Ana's Netflix"));
  const subB = await db.asUser(USER_B, (tx) => insertSubscription(tx, USER_B, "Bo's Spotify"));
  return { subA, subB };
}

describe('schema hardening', () => {
  it('applies every migration in supabase/migrations', () => {
    expect(db.appliedMigrations.length).toBeGreaterThanOrEqual(3);
    expect(db.appliedMigrations).toEqual([...db.appliedMigrations].sort());
  });

  it('enables RLS on every user-data table', async () => {
    const rows = await db.query<{ tablename: string; rowsecurity: boolean }>(
      `select c.relname as tablename, c.relrowsecurity as rowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by c.relname`,
    );
    const byName = new Map(rows.map((r) => [r.tablename, r.rowsecurity]));
    for (const table of OWNED_TABLES) {
      expect({ table, rls: byName.get(table) }).toEqual({ table, rls: true });
    }
  });

  it('has a per-operation policy with WITH CHECK on insert and update', async () => {
    // Note: Postgres folds unquoted identifiers to lower case, so the alias
    // comes back as `with_check`, not `withCheck`.
    const rows = await db.query<{ tablename: string; cmd: string; with_check: string | null }>(
      `select tablename, cmd, with_check from pg_policies where schemaname = 'public'`,
    );
    for (const table of OWNED_TABLES) {
      for (const cmd of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const policy = rows.find((r) => r.tablename === table && r.cmd === cmd);
        expect({ table, cmd, present: Boolean(policy) }).toEqual({ table, cmd, present: true });
        if (cmd === 'INSERT' || cmd === 'UPDATE') {
          expect(policy!.with_check).toContain('auth.uid()');
        }
      }
    }
  });

  it('never opens a policy with `using (true)`', async () => {
    const rows = await db.query<{ tablename: string; qual: string | null }>(
      `select tablename, qual from pg_policies where schemaname = 'public'`,
    );
    for (const row of rows) {
      expect(row.qual ?? '').not.toMatch(/^\s*true\s*$/);
    }
  });

  it('exposes (id, user_id) as a composite reference target on subscriptions', async () => {
    const rows = await db.query<{ conname: string }>(
      `select conname from pg_constraint
        where conrelid = 'public.subscriptions'::regclass and contype = 'u'`,
    );
    expect(rows.some((r) => r.conname === 'subscriptions_id_user_id_key')).toBe(true);
  });

  it('points child foreign keys at (subscription_id, user_id)', async () => {
    const rows = await db.query<{ table: string; key: string }>(
      `select regexp_replace(conrelid::regclass::text, '^public\\.', '') as table,
              pg_get_constraintdef(oid) as key
         from pg_constraint
        where contype = 'f'
          and confrelid = 'public.subscriptions'::regclass
        order by 1`,
    );
    for (const child of ['billing_events', 'notification_records']) {
      const fk = rows.find((r) => r.table === child);
      expect({ child, fk: fk?.key }).toEqual({
        child,
        fk: expect.stringContaining('(subscription_id, user_id)'),
      });
    }
  });
});

describe('two-user isolation (RLS)', () => {
  let subA: string;

  beforeAll(async () => {
    ({ subA } = await seedOwnedSubscriptions());
    await db.exec(`
      insert into public.billing_events
        (subscription_id, user_id, expected_date, amount_cents, currency, type)
      values ('${subA}', '${USER_A}', '2026-11-01', 1599, 'USD', 'renewal');
      insert into public.notification_preferences (user_id) values ('${USER_A}');
      insert into public.notification_records
        (user_id, subscription_id, dedup_key, type)
      values ('${USER_A}', '${subA}', 'seed-key', 'renewal');
    `);
  });

  it('hides every other user’s rows on read, while showing your own', async () => {
    await db.asUser(USER_B, async (tx) => {
      for (const table of OWNED_TABLES) {
        const ownerColumn = table === 'profiles' ? 'id' : 'user_id';
        const others = await tx.query(
          `select count(*)::int as n from public.${table} where ${ownerColumn} = $1`,
          [USER_A],
        );
        expect({ table, otherUsersRowsVisible: (others.rows[0] as { n: number }).n }).toEqual({
          table,
          otherUsersRowsVisible: 0,
        });
      }
      const mine = await tx.query(
        `select count(*)::int as n from public.subscriptions where user_id = $1`,
        [USER_B],
      );
      expect((mine.rows[0] as { n: number }).n).toBe(1);
    });
  });

  it('refuses to insert a row owned by another user', async () => {
    await expect(
      db.asUser(USER_B, (tx) => insertSubscription(tx, USER_A, 'Sneaky')),
    ).rejects.toMatchObject({ code: RLS_VIOLATION });
  });

  it('refuses to update another user’s row (0 rows, no silent success)', async () => {
    const changed = await db.asUser(USER_B, async (tx) => {
      const result = await tx.query(
        `update public.subscriptions set name = 'Hijacked' where id = $1 returning id`,
        [subA],
      );
      return result.rows.length;
    });
    expect(changed).toBe(0);
    const [row] = await db.query<{ name: string }>(
      `select name from public.subscriptions where id = $1`,
      [subA],
    );
    expect(row.name).toBe("Ana's Netflix");
  });

  it('refuses to delete another user’s row', async () => {
    const deleted = await db.asUser(USER_B, async (tx) => {
      const result = await tx.query(`delete from public.subscriptions where id = $1 returning id`, [
        subA,
      ]);
      return result.rows.length;
    });
    expect(deleted).toBe(0);
  });

  it('lets each user manage their own rows', async () => {
    await db.asUser(USER_A, async (tx) => {
      const renamed = await tx.query(
        `update public.subscriptions set name = 'Renamed by Ana' where user_id = $1 returning name`,
        [USER_A],
      );
      expect(renamed.rows.length).toBe(1);
      expect((renamed.rows[0] as { name: string }).name).toBe('Renamed by Ana');
    });
  });

  it('defaults user_id to the caller when omitted', async () => {
    const [row] = await db.asUser(USER_B, async (tx) => {
      const created = await tx.query<{ user_id: string }>(
        `insert into public.subscriptions
           (name, amount_cents, currency, interval_every, interval_unit)
         values ('No explicit owner', 500, 'USD', 1, 'month')
         returning user_id`,
      );
      return created.rows;
    });
    expect(row.user_id).toBe(USER_B);
  });
});

describe('composite FK ownership — one user cannot attach rows to another’s subscription', () => {
  let subA: string;
  let subB: string;

  beforeAll(async () => {
    ({ subA, subB } = await seedOwnedSubscriptions());
  });

  it('rejects a billing_event pointing at another user’s subscription', async () => {
    await expect(
      db.asUser(USER_B, (tx) =>
        tx.query(
          `insert into public.billing_events
             (subscription_id, user_id, expected_date, amount_cents, currency, type)
           values ($1, $2, '2026-11-01', 1599, 'USD', 'renewal')`,
          [subA, USER_B],
        ),
      ),
    ).rejects.toMatchObject({ code: FK_VIOLATION });
  });

  it('rejects a notification_record pointing at another user’s subscription', async () => {
    await expect(
      db.asUser(USER_B, (tx) =>
        tx.query(
          `insert into public.notification_records (user_id, subscription_id, dedup_key, type)
           values ($1, $2, 'cross-user-key', 'renewal')`,
          [USER_B, subA],
        ),
      ),
    ).rejects.toMatchObject({ code: FK_VIOLATION });
  });

  it('still allows attaching to your own subscription', async () => {
    await db.asUser(USER_B, async (tx) => {
      const result = await tx.query(
        `insert into public.billing_events
           (subscription_id, user_id, expected_date, amount_cents, currency, type)
         values ($1, $2, '2026-11-01', 999, 'USD', 'renewal') returning id`,
        [subB, USER_B],
      );
      expect(result.rows.length).toBe(1);
    });
  });

  it('still allows records with no subscription (weekly digest)', async () => {
    await db.asUser(USER_B, async (tx) => {
      const result = await tx.query(
        `insert into public.notification_records (user_id, subscription_id, dedup_key, type)
         values ($1, null, 'weekly_digest:2026-11-02', 'weekly_digest') returning id`,
        [USER_B],
      );
      expect(result.rows.length).toBe(1);
    });
  });

  it('cascades child rows when a subscription is deleted', async () => {
    await db.asUser(USER_B, async (tx) => {
      await tx.query(`delete from public.subscriptions where id = $1`, [subB]);
      const remaining = await tx.query(
        `select count(*)::int as n from public.billing_events where subscription_id = $1`,
        [subB],
      );
      expect((remaining.rows[0] as { n: number }).n).toBe(0);
    });
  });
});

describe('the composite FK actually closes a real gap', () => {
  it('would have ALLOWED the cross-user attach before migration 0002', async () => {
    // Proof the test above is not vacuous: on the pre-0002 schema the same
    // insert succeeds, because a plain FK on (id) ignores who owns the row.
    const legacy = await createTestDatabase('0001_initial_schema.sql');
    try {
      await seedUsers(legacy);
      const subA = await legacy.asUser(USER_A, (tx) => insertSubscription(tx, USER_A, 'Legacy'));
      const inserted = await legacy.asUser(USER_B, async (tx) => {
        const result = await tx.query(
          `insert into public.billing_events
             (subscription_id, user_id, expected_date, amount_cents, currency, type)
           values ($1, $2, '2026-11-01', 1599, 'USD', 'renewal') returning id`,
          [subA, USER_B],
        );
        return result.rows.length;
      });
      expect(inserted).toBe(1);
    } finally {
      await legacy.close();
    }
  }, 120_000);
});
