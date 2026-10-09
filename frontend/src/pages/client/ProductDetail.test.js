import { buildProductGalleryImages } from '../../utils/productGallery';

describe('product color gallery', () => {
  it('shows every color image and keeps the color attached to each image', () => {
    const product = {
      mainImageUrl: '/red-front.jpg',
      images: [{ url: '/overview.jpg' }],
    };
    const variants = [
      { colorId: 1, images: [{ url: '/legacy-red.jpg' }] },
      { colorId: 2, images: [{ url: '/legacy-blue.jpg' }] },
    ];
    const colors = [{ id: 1 }, { id: 2 }];
    const colorImages = new Map([
      ['1', ['/red-front.jpg', '/red-back.jpg']],
      ['2', ['/blue-front.jpg']],
    ]);

    expect(buildProductGalleryImages(product, variants, colors, colorImages)).toEqual([
      { url: '/red-front.jpg', colorId: 1 },
      { url: '/overview.jpg', colorId: '' },
      { url: '/red-back.jpg', colorId: 1 },
      { url: '/blue-front.jpg', colorId: 2 },
    ]);
  });

  it('falls back to the placeholder when the product has no images', () => {
    expect(buildProductGalleryImages({}, [], [], new Map())).toEqual([
      { url: '/placeholder.jpg', colorId: '' },
    ]);
  });
});
