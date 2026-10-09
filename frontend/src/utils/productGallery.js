const toText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return toText(value.name);
  return String(value).trim();
};

const normalizeId = (value) => String(value ?? '');

const getImageUrls = (images) =>
  (Array.isArray(images) ? images : [])
    .map((image) => toText(image?.url ?? image?.Url ?? image))
    .filter(Boolean);

export const buildProductGalleryImages = (product, variants, colorOptions, colorImagesById) => {
  const mainImage = toText(product?.mainImageUrl);
  const otherImages = getImageUrls(product?.images).filter((image) => image !== mainImage);
  const baseImages = mainImage ? [mainImage, ...otherImages] : otherImages;
  const items = [];
  const indexByUrl = new Map();

  const addImage = (url, colorId = '') => {
    const normalizedUrl = toText(url);
    if (!normalizedUrl) return;

    if (indexByUrl.has(normalizedUrl)) {
      const existing = items[indexByUrl.get(normalizedUrl)];
      if (!existing.colorId && colorId) existing.colorId = colorId;
      return;
    }

    indexByUrl.set(normalizedUrl, items.length);
    items.push({ url: normalizedUrl, colorId });
  };

  baseImages.forEach((url) => addImage(url));
  colorOptions.forEach((color) => {
    const colorId = normalizeId(color.id);
    const groupedImages = colorImagesById.get(colorId) || [];
    const legacyImages = variants
      .filter((variant) => normalizeId(variant.colorId) === colorId)
      .flatMap((variant) => getImageUrls(variant.images));
    const images = groupedImages.length > 0 ? groupedImages : legacyImages;
    images.forEach((url) => addImage(url, color.id));
  });

  return items.length > 0 ? items : [{ url: '/placeholder.jpg', colorId: '' }];
};
