use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;

const LICENSE_SALT: &str = "zerogpu-forge-2026";

const PRO_FEATURES: &[&str] = &[
    "speculative_decoding",
    "server_mode",
    "export",
    "coding_mode",
    "unlimited_models",
    "continuous_batching",
    "paged_attention",
    "optimization_profiles",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LicenseTier {
    Free,
    Pro,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub tier: LicenseTier,
    pub key_masked: String,
    pub activated_at: Option<String>,
}

/// Validate a license key format (XXXX-XXXX-XXXX-XXXX-XXXX, alphanumeric) and tier.
pub fn validate_license_key(key: &str) -> Result<LicenseTier, String> {
    // Check format: 5 groups of 4 alphanumeric chars separated by dashes
    let parts: Vec<&str> = key.split('-').collect();
    if parts.len() != 5 {
        return Err("Invalid license key format. Expected XXXX-XXXX-XXXX-XXXX-XXXX.".to_string());
    }
    for part in &parts {
        if part.len() != 4 || !part.chars().all(|c| c.is_ascii_alphanumeric()) {
            return Err(
                "Invalid license key format. Each segment must be 4 alphanumeric characters."
                    .to_string(),
            );
        }
    }

    // SHA-256 hash check with salt to determine tier
    let salted = format!("{}{}", key, LICENSE_SALT);
    let mut hasher = Sha256::new();
    hasher.update(salted.as_bytes());
    let hash = hasher.finalize();
    let hash_hex = format!("{:x}", hash);

    // Pro keys: hash starts with "00" (simple deterministic check)
    if hash_hex.starts_with("00") {
        Ok(LicenseTier::Pro)
    } else {
        // Valid format but not a Pro key — treat as Free tier activation
        Ok(LicenseTier::Free)
    }
}

/// Check if a feature is allowed for the given license tier.
pub fn is_pro_feature_allowed(tier: &LicenseTier, feature: &str) -> bool {
    match tier {
        LicenseTier::Pro => true,
        LicenseTier::Free => !PRO_FEATURES.contains(&feature),
    }
}

/// Mask a license key for display (show first and last segments).
pub fn mask_key(key: &str) -> String {
    let parts: Vec<&str> = key.split('-').collect();
    if parts.len() == 5 {
        format!("{}-****-****-****-{}", parts[0], parts[4])
    } else {
        "****".to_string()
    }
}

fn license_file_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".zerogpu-forge")
        .join("license.key")
}

/// Save a license key to disk.
pub fn save_license(key: &str) -> Result<(), String> {
    let path = license_file_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&path, key).map_err(|e| format!("Failed to save license: {}", e))
}

/// Load a license key from disk.
pub fn load_license() -> Option<String> {
    let path = license_file_path();
    fs::read_to_string(path).ok().map(|s| s.trim().to_string())
}
