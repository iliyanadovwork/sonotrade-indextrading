import React from "react";
import { Img } from "remotion";
import { avatarColor } from "../../brand";

// Circular avatar with the app's initials fallback (HomeTableRow /
// SXSidebarProfileList use zinc-800 + zinc-500 initials; the header profile
// bubble uses avatarColor(username)).
export const Avatar: React.FC<{
  src: string | null;
  name: string;
  size: number;
  colored?: boolean;
  className?: string;
}> = ({ src, name, size, colored = false, className }) => {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  if (src) {
    return (
      <Img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${className ?? ""}`}
        style={{ width: size, height: size, flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full select-none ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        background: colored ? avatarColor(name) : "#27272a",
        color: colored ? "#ffffff" : "#71717a",
        fontSize: Math.max(8, Math.round(size / 3)),
        fontWeight: colored ? 600 : 500,
      }}
    >
      {colored ? initials.charAt(0) : initials}
    </div>
  );
};
