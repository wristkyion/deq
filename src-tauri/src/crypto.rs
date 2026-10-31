use argon2::Argon2;
use chacha20poly1305::{aead::{Aead, KeyInit}, XChaCha20Poly1305, XNonce};
use rand::{rngs::OsRng, RngCore};

pub type Key = [u8; 32];

pub fn rnd<const N: usize>() -> [u8; N] { let mut b = [0u8; N]; OsRng.fill_bytes(&mut b); b }

/// Argon2id: turns a password or recovery key into a 32-byte wrapping key.
pub fn kdf(secret: &[u8], salt: &[u8]) -> Result<Key, String> {
    let mut k = [0u8; 32];
    Argon2::default().hash_password_into(secret, salt, &mut k).map_err(|x| x.to_string())?;
    Ok(k)
}
fn cipher(k: &Key) -> Result<XChaCha20Poly1305, String> { XChaCha20Poly1305::new_from_slice(k).map_err(|x| x.to_string()) }

/// Output layout: 24-byte nonce followed by the ciphertext.
pub fn seal(k: &Key, data: &[u8]) -> Result<Vec<u8>, String> {
    let n = rnd::<24>();
    let mut out = n.to_vec();
    out.extend(cipher(k)?.encrypt(XNonce::from_slice(&n), data).map_err(|x| x.to_string())?);
    Ok(out)
}
pub fn open(k: &Key, blob: &[u8]) -> Result<Vec<u8>, String> {
    if blob.len() < 25 { return Err("Corrupt data".into()); }
    let (n, c) = blob.split_at(24);
    cipher(k)?.decrypt(XNonce::from_slice(n), c).map_err(|_| "Wrong password or key".to_string())
}
pub fn hex(b: &[u8]) -> String { b.iter().map(|x| format!("{x:02x}")).collect() }
pub fn unhex(s: &str) -> Option<Key> {
    if s.len() != 64 { return None; }
    let mut k = [0u8; 32];
    for i in 0..32 { k[i] = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).ok()?; }
    Some(k)
}
