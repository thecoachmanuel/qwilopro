export function getImageURL(path) {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) {
        return path;
    }
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return (API_IMAGES_BASE_URL || "") + cleanPath;
}