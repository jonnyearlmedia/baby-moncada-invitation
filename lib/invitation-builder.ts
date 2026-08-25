const HONORIFICS = new Set(["auntie", "uncle", "ate", "kuya"]);

export function parseGuestNames(value: string) {
  return value
    .replace(/\r?\n|;/g, ",")
    .replace(/\s+(?:&|and)\s+/gi, ",")
    .split(",")
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

export function joinGuestNames(names: string[]) {
  if (names.length < 2) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, & ${names.at(-1)}`;
}

function greetingName(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0];
  return HONORIFICS.has(words[0].toLocaleLowerCase()) ? words.slice(0, 2).join(" ") : words[0];
}

export function suggestMessageGreeting(names: string[]) {
  return joinGuestNames(names.map(greetingName));
}

function slugPart(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function suggestSlug(names: string[]) {
  const surnames = names.flatMap((name) => {
    const words = name.split(/\s+/).filter(Boolean);
    const meaningful = HONORIFICS.has(words[0]?.toLocaleLowerCase()) ? words.slice(1) : words;
    return meaningful.length > 1 ? [slugPart(meaningful.at(-1) ?? "")] : [];
  }).filter(Boolean);
  const uniqueSurnames = [...new Set(surnames)];
  const parts = uniqueSurnames.length ? uniqueSurnames.slice(0, 2) : names.slice(0, 2).map(greetingName).map(slugPart).filter(Boolean);
  return (parts.join("-") || "invitation").slice(0, 72).replace(/-$/g, "");
}
