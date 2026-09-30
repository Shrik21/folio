const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type IntroInput = {
  name?: string;
  headline?: string;
  email?: string;
};

export type IntroErrors = Partial<Record<"name" | "headline" | "email", string>>;

export function validateIntro(input: IntroInput): IntroErrors {
  const errors: IntroErrors = {};
  const name = input.name?.trim() || "";
  const headline = input.headline?.trim() || "";
  const email = input.email?.trim() || "";
  if (!name) errors.name = "Enter your name so visitors know who you are.";
  else if (name.length > 120) errors.name = "Keep your name under 120 characters.";
  if (!headline) errors.headline = "Add a short headline that describes your work.";
  else if (headline.length > 200) errors.headline = "Keep your headline under 200 characters.";
  if (email && !emailPattern.test(email)) errors.email = "Enter a valid email, or leave this field blank.";
  return errors;
}

export function hasIntroErrors(errors: IntroErrors) {
  return Object.keys(errors).length > 0;
}
