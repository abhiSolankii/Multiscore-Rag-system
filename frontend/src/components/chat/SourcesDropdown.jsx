import { Dropdown } from "antd";
import { ChevronDown, Globe } from "lucide-react";
import CitationChip from "./CitationChip";

const SourcesDropdown = ({ usedChunks = [], onCitationClick }) => {
  if (!usedChunks?.length) return null;

  // Each citation chip becomes an item in the menu
  // Keep indices clear (1-indexed matching the Source 1, Source 2... in-line)
  const menuItems = usedChunks.map((chunk, idx) => ({
    key: `source-${idx}`,
    label: (
      <div className="py-1 px-1">
        <CitationChip
          index={idx + 1}
          chunk={chunk}
          onClick={() => onCitationClick(chunk)}
        />
      </div>
    ),
  }));

  return (
    <Dropdown
      menu={{ items: menuItems }}
      placement="topRight"
      trigger={["click"]}
      dropdownRender={(menu) => (
        <div className="bg-gray-900/90 backdrop-blur-md border border-gray-800 rounded-xl shadow-2xl p-1 max-h-64 overflow-y-auto thin-scrollbar">
          {menu}
        </div>
      )}
    >
      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/60 hover:bg-indigo-900/40 border border-gray-700/50 hover:border-indigo-500/30 text-xs text-gray-400 hover:text-indigo-300 rounded-full transition-all group shadow-sm">
        <Globe
          size={13}
          className="text-gray-500 group-hover:text-indigo-400"
        />
        <span className="font-semibold tracking-wide">Sources</span>
        <ChevronDown
          size={11}
          className="transition-transform group-hover:rotate-180 text-gray-600"
        />
      </button>
    </Dropdown>
  );
};

export default SourcesDropdown;
