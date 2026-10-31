import crypto from "node:crypto";

const getKey = () => {
  const value = process.env.OODO_ENCRYPTION_KEY;

  if (!value) {
    throw new Error("OODO_ENCRYPTION_KEY is not configured");
  }

  const key = Buffer.from(value, "base64");

  if (key.length !== 32) {
    throw new Error(
      "OODO_ENCRYPTION_KEY must be a base64-encoded 32-byte key"
    );
  }

  return key;
};

export const encryptJson = (value) => {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    getKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final()
  ]);

  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64")
  });
};

export const decryptJson = (ciphertext) => {
  const item = JSON.parse(ciphertext);

  if (item.v !== 1) {
    throw new Error("Unsupported encrypted value version");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(item.iv, "base64")
  );

  decipher.setAuthTag(Buffer.from(item.tag, "base64"));

  const clear = Buffer.concat([
    decipher.update(Buffer.from(item.data, "base64")),
    decipher.final()
  ]);

  return JSON.parse(clear.toString("utf8"));
};