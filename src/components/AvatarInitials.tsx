// Renders a small circular avatar with a person's initials. Deterministic
// background tint per name so the same person reads consistently.
const TINTS = ["#0a1f44", "#2563eb", "#0e7490", "#2e7d32", "#92400e", "#6d28d9"];

export function AvatarInitials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i)) % TINTS.length;
  return (
    <span className="avatar-initials" style={{ background: TINTS[hash] }} aria-hidden="true">
      {(initials || "?").toUpperCase()}
    </span>
  );
}
