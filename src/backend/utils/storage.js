const fs = require("fs");
const path = require("path");
const axios = require("axios");

/**
 * Upload an image buffer or file to cloud storage (Cloudinary) if configured,
 * or write to the local /public/{tenantId} folder, or fallback to Data URL.
 * 
 * Configured via environment variables:
 * - CLOUDINARY_CLOUD_NAME & CLOUDINARY_UPLOAD_PRESET (or CLOUDINARY_API_KEY & CLOUDINARY_API_SECRET)
 */
async function saveImageFile({ file, buffer, mimeType, filename, tenantId }) {
  const isVercel = Boolean(process.env.VERCEL);
  const ext = path.extname(filename || "") || ".png";
  const mime = mimeType || file?.mimetype || "image/png";

  // Ensure buffer
  let fileBuffer = buffer;
  if (!fileBuffer && file) {
    if (file.tempFilePath && fs.existsSync(file.tempFilePath)) {
      fileBuffer = fs.readFileSync(file.tempFilePath);
    } else if (file.data) {
      fileBuffer = file.data;
    }
  }

  // 1. Try Cloudinary cloud storage if configured
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (cloudName && fileBuffer) {
    try {
      const base64Data = `data:${mime};base64,${fileBuffer.toString("base64")}`;
      const payload = {
        file: base64Data,
        folder: `qwilopro/${tenantId || 'general'}`,
      };
      if (uploadPreset) {
        payload.upload_preset = uploadPreset;
      }

      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        payload,
        { timeout: 15000 }
      );

      if (response.data && response.data.secure_url) {
        return response.data.secure_url;
      }
    } catch (cloudErr) {
      console.warn("Cloudinary upload failed, proceeding to fallback:", cloudErr?.message);
    }
  }

  // 2. Try Local Filesystem storage (on standalone servers / local dev)
  if (!isVercel) {
    try {
      const tenantPublicDir = path.resolve(process.cwd(), "public", String(tenantId));
      if (!fs.existsSync(tenantPublicDir)) {
        fs.mkdirSync(tenantPublicDir, { recursive: true });
      }

      const fullFilename = `${filename}${filename.includes(".") ? "" : ext}`;
      const targetPath = path.join(tenantPublicDir, fullFilename);

      if (file && typeof file.mv === "function") {
        await file.mv(targetPath);
      } else if (fileBuffer) {
        fs.writeFileSync(targetPath, fileBuffer);
      }

      return `/public/${tenantId}/${fullFilename}`;
    } catch (fsErr) {
      console.warn("Local disk write failed, falling back to Data URL:", fsErr.message);
    }
  }

  // 3. Fallback: Base64 Data URL (ephemeral serverless environment without cloud credentials)
  if (fileBuffer) {
    return `data:${mime};base64,${fileBuffer.toString("base64")}`;
  }

  throw new Error("Unable to process or persist image file");
}

module.exports = {
  saveImageFile,
};
