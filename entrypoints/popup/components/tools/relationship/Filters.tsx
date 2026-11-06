export interface AccountFilters {
  verified: boolean;
  public: boolean;
  private: boolean;
}

export const ACCOUNT_FILTERS_DEFAULT: AccountFilters = {
  verified: false,
  public: false,
  private: false,
};

interface FiltersProps {
  value: AccountFilters;
  onChange: (value: AccountFilters) => void;
}

const rowCls =
  "flex w-full select-none items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/70 px-2 py-1.5 transition-colors cursor-pointer hover:bg-zinc-700/70";
const activeRowCls = "border-brand/60 bg-zinc-700/70";
const inputCls = "h-3.5 w-3.5 shrink-0 cursor-pointer accent-brand";
const labelCls = "w-full cursor-pointer truncate text-xs font-medium text-zinc-200";

type FilterKey = keyof AccountFilters;

const OPTIONS: { id: FilterKey; label: string }[] = [
  { id: "verified", label: "Verified ✓" },
  { id: "public", label: "Public" },
  { id: "private", label: "Private" },
];

export function Filters({ value, onChange }: FiltersProps) {
  const toggle = (key: FilterKey) =>
    onChange({ ...value, [key]: !value[key] });

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {OPTIONS.map((opt) => (
        <label
          key={opt.id}
          className={`${rowCls} ${value[opt.id] ? activeRowCls : ""}`}
        >
          <input
            type="checkbox"
            className={inputCls}
            checked={value[opt.id]}
            onChange={() => toggle(opt.id)}
          />
          <span className={labelCls}>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

export default Filters;
