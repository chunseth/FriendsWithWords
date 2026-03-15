# Create a Certificate Signing Request (CSR) via Terminal

If Keychain Access → Certificate Assistant isn't visible, use Terminal:

## 1. Generate a private key and CSR

Run (replace "Your Name" and "your@email.com" with your details):

```bash
openssl req -new -newkey rsa:2048 -nodes \
  -keyout private_key.key \
  -out CertificateSigningRequest.certSigningRequest \
  -subj "/CN=Your Name/emailAddress=your@email.com"
```

This creates:
- `private_key.key` — **keep this private and backed up.** Apple's certificate will need the key that matches the CSR; for Apple Developer certificates, Apple expects the key to be created via Keychain (see below). So for **Apple** use, the Keychain method is preferred when possible.

## 2. For Apple Developer (recommended): use Keychain

Apple expects the **private key to be in your Keychain** when you create the CSR. So if Terminal was used, you'd need to import the key into Keychain and Apple's workflow is really designed for the Keychain-generated CSR.

**Easiest path:** In Keychain Access, make sure you're looking at the **leftmost menu in the menu bar** (the one with the Keychain Access icon / name). That's where **Certificate Assistant** lives. If it's not there, try:

- **View** menu → make sure no "Hide" is affecting the menu.
- Or create a new key and request: **File** → **New** → some versions have **Certificate Request** or similar under **File**.

## 3. Alternative: Xcode

If you have Xcode:
1. Xcode → **Settings** (or Preferences) → **Accounts**.
2. Select your Apple ID → **Manage Certificates**.
3. **+** → **Apple Distribution** or **Apple Development** — Xcode can create the signing key and you may be able to export or use it for other certificates. For a **CSR file** to upload to the Apple Developer website, Keychain Access (or the Terminal method above) is still the standard.
