let idSeq = 1000;

export const nextId = (p = "id") => `${p}${idSeq++}`;

export const nowStamp = () => "just now";
