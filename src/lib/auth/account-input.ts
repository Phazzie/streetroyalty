export function accountInputError(input: {
  mode: "in" | "up";
  email: string;
  password: string;
  name: string;
}): string | null {
  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "That email does not look right.";
  if (input.password.length < 8 || input.password.trim().length < 8) {
    return "Use at least 8 characters in the password.";
  }
  if (input.mode === "up" && input.name.trim().length > 80) return "That name is too long.";
  return null;
}
