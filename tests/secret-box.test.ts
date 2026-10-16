import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "@/server/secret-box";

afterEach(() => vi.unstubAllEnvs());

describe("secret box", () => {
  it("round-trips and never stores the plain text", () => {
    vi.stubEnv("SETTINGS_SECRET", "test-secret");
    const sealed = encryptSecret("sk-proj-abcdef123456");
    expect(sealed).not.toContain("abcdef");
    expect(decryptSecret(sealed)).toBe("sk-proj-abcdef123456");
    expect(encryptSecret("same")).not.toBe(encryptSecret("same")); // random IV
  });

  it("returns null when the secret changed or the value was tampered with", () => {
    vi.stubEnv("SETTINGS_SECRET", "one");
    const sealed = encryptSecret("key");
    vi.stubEnv("SETTINGS_SECRET", "two");
    expect(decryptSecret(sealed)).toBeNull();
    vi.stubEnv("SETTINGS_SECRET", "one");
    const [v, iv, tag, data] = sealed.split(":");
    expect(decryptSecret([v, iv, tag, Buffer.from("x" + data).toString("base64")].join(":"))).toBeNull();
    expect(decryptSecret("garbage")).toBeNull();
  });

  it("masks keys", () => {
    expect(maskSecret("sk-proj-abcdef123456")).toBe("sk-…3456");
    expect(maskSecret("AIzaSyA1234567890xyz")).toBe("AIz…0xyz");
  });
});
