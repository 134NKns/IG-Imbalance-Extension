import { useState } from "react";
import { RelationshipView } from "./relationship";
import { PostViewer } from "./PostViewer";

interface ToolsProps {
  userId: string | null;
  postShortcode?: string | null;
}

const TOOLS = [
  { id: "relation", label: "Relation" },
  { id: "post", label: "Post Download" },
] as const;
type ToolId = (typeof TOOLS)[number]["id"];

export function Tools({ userId, postShortcode }: ToolsProps) {
  const [activeTool, setActiveTool] = useState<ToolId>("relation");

  const tabBase =
    "w-full border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100 focus:outline-none";
  const tabActive = "bg-brand text-white hover:bg-brand/90 hover:text-white";

  return (
    <section className="flex flex-1 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      {/* Tools nav */}
      <nav className="flex flex-col gap-2 border-b border-zinc-800 px-2 py-2">
        <ul className="flex -space-x-px text-center">
          {TOOLS.map((tool, i) => {
            const isActive = activeTool === tool.id;
            const isFirst = i === 0;
            const isLast = i === TOOLS.length - 1;
            return (
              <li key={tool.id} className="w-full focus-within:z-10">
                <button
                  type="button"
                  className={`${tabBase} ${isActive ? tabActive : ""} ${
                    isFirst ? "rounded-s-md" : ""
                  } ${isLast ? "rounded-e-md" : ""}`}
                  onClick={() => setActiveTool(tool.id)}
                >
                  {tool.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Tool content */}
      <div className="flex flex-1 flex-col overflow-hidden p-2.5">
        {activeTool === "relation" ? (
          <RelationshipView userId={userId} />
        ) : (
          <PostViewer postShortcode={postShortcode} />
        )}
      </div>
    </section>
  );
}

export default Tools;
