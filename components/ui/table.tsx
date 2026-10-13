import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { ScrollView, View, type ViewProps } from 'react-native';

function Table({ className, children, ...props }: ViewProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="min-w-full"
      data-slot="table-container"
    >
      <View
        data-slot="table"
        dataSet={{ slot: 'table' }}
        className={cn('min-w-[420px] flex-1 text-sm', className)}
        {...props}
      >
        {children}
      </View>
    </ScrollView>
  );
}

function TableHeader({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="table-header"
      dataSet={{ slot: 'table-header' }}
      className={cn('border-b border-border bg-muted/30', className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="table-body"
      dataSet={{ slot: 'table-body' }}
      className={cn('flex-col', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="table-footer"
      dataSet={{ slot: 'table-footer' }}
      className={cn('border-t border-border bg-muted/50 font-medium', className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="table-row"
      dataSet={{ slot: 'table-row' }}
      className={cn(
        'flex-row items-center border-b border-border web:transition-colors web:hover:bg-muted/50 active:bg-muted/50',
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, children, ...props }: ViewProps) {
  return (
    <TextClassContext.Provider value="text-xs font-medium text-muted-foreground">
      <View
        data-slot="table-head"
        dataSet={{ slot: 'table-head' }}
        className={cn(
          'h-10 flex-1 justify-center px-3 text-left align-middle font-medium',
          className,
        )}
        {...props}
      >
        {typeof children === 'string' ? (
          <Text className="text-xs font-medium text-muted-foreground">{children}</Text>
        ) : (
          children
        )}
      </View>
    </TextClassContext.Provider>
  );
}

function TableCell({ className, children, ...props }: ViewProps) {
  return (
    <TextClassContext.Provider value="text-sm text-foreground">
      <View
        data-slot="table-cell"
        dataSet={{ slot: 'table-cell' }}
        className={cn('flex-1 justify-center px-3 py-2.5 align-middle', className)}
        {...props}
      >
        {typeof children === 'string' ? <Text className="text-sm">{children}</Text> : children}
      </View>
    </TextClassContext.Provider>
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      data-slot="table-caption"
      dataSet={{ slot: 'table-caption' }}
      variant="muted"
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
