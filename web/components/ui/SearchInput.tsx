import { InputHTMLAttributes, ReactNode, forwardRef } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, icon, ...props }, ref) => (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 flex text-muted">
        {icon ?? <Search size={18} />}
      </span>
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-[2px] border border-border bg-background pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-2 focus:border-accent",
          className,
        )}
        {...props}
      />
    </div>
  ),
);
SearchInput.displayName = "SearchInput";
