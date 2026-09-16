import * as React from "react"
import {
  CSXText,
  type CSXTextVariant,
  type SXColorToken,
} from "./core/CSXText"
import { cn } from "./utils"

/**
 * Table copy defaults (Pauv / CSX):
 * - `TableHead`: `body3` + `STMuted`
 * - `TableCell`: `body3` + `STWhite`
 *
 * Set `plain` to skip the wrapper for non-text cells (skeletons, charts, or custom layouts).
 * For avatar + name rows, use `plain` on the cell and `TableCellText` for the label.
 */

export type TableHeadProps = React.ThHTMLAttributes<HTMLTableCellElement> & {
  /** Skip CSXText (e.g. custom header content). Headers are text by default. */
  plain?: boolean
  textVariant?: CSXTextVariant
  textColor?: SXColorToken | string
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, plain, textVariant, textColor, children, ...props }, ref) => {
    const inner =
      plain ? (
        children
      ) : (
        <CSXText variant={textVariant ?? "body3"} color={textColor ?? "STMuted"}>
          {children}
        </CSXText>
      )
    return (
      <th
        ref={ref}
        className={cn(
          "px-4 py-3 text-left align-middle [&:has([role=checkbox])]:pr-0",
          plain && "font-medium text-zinc-400",
          className
        )}
        {...props}
      >
        {inner}
      </th>
    )
  }
)
TableHead.displayName = "TableHead"

export type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  /** Skip CSXText for charts, skeletons, or layouts that include `TableCellText` manually. */
  plain?: boolean
  textVariant?: CSXTextVariant
  textColor?: SXColorToken | string
}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, plain, textVariant, textColor, children, ...props }, ref) => {
    const inner =
      plain ? (
        children
      ) : (
        <CSXText variant={textVariant ?? "body3"} color={textColor ?? "STWhite"}>
          {children}
        </CSXText>
      )
    return (
      <td
        ref={ref}
        className={cn("px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0", className)}
        {...props}
      >
        {inner}
      </td>
    )
  }
)
TableCell.displayName = "TableCell"

/** CSX label inside a `plain` `TableCell` (e.g. next to an avatar). Defaults match numeric body cells. */
export function TableCellText({
  variant = "body3",
  color = "STWhite",
  children,
}: {
  variant?: CSXTextVariant
  color?: SXColorToken | string
  children?: React.ReactNode
}) {
  return (
    <CSXText variant={variant} color={color}>
      {children}
    </CSXText>
  )
}

// Define Table components locally since we don't have @/components/ui/table
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-visible">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
  )
)
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody
      ref={ref}
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
)
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn("border-t bg-zinc-900/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  )
)
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b border-zinc-800 hover:bg-zinc-900/50 data-[state=selected]:bg-zinc-900", className)}
      {...props}
    />
  )
)
TableRow.displayName = "TableRow"

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption
      ref={ref}
      className={cn("mt-4 text-sm text-zinc-400", className)}
      {...props}
    />
  )
)
TableCaption.displayName = "TableCaption"

export interface SXTableProps extends React.HTMLAttributes<HTMLTableElement> {
  variant?: "default" | "bloomberg"
  children?: React.ReactNode
}

const SXTable = React.forwardRef<HTMLTableElement, SXTableProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <Table
        ref={ref}
        className={cn(
          variant === "bloomberg" ? "text-xs" : "",
          className
        )}
        {...props}
      >
        {children}
      </Table>
    )
  }
)
SXTable.displayName = "SXTable"

export { SXTable, TableBody, TableCell, TableHead, TableHeader, TableRow }
