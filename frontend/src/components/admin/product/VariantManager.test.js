import { buildColorImageGroups, synchronizeColorImages } from './VariantManager';

describe('variant color images', () => {
  const variants = [
    { id: 1, colorId: 10, sizeId: 1, images: [{ url: '/red-front.jpg' }, { url: '/red-back.jpg' }] },
    { id: 2, colorId: 10, sizeId: 2, images: [] },
    { id: 3, colorId: 20, sizeId: 1, images: [{ url: '/blue.jpg' }] },
  ];

  it('uses one shared image set for every size of the same color', () => {
    const synchronized = synchronizeColorImages(variants);

    expect(synchronized[0].images.map((image) => image.url)).toEqual(['/red-front.jpg', '/red-back.jpg']);
    expect(synchronized[1].images.map((image) => image.url)).toEqual(['/red-front.jpg', '/red-back.jpg']);
    expect(synchronized[2].images.map((image) => image.url)).toEqual(['/blue.jpg']);
  });

  it('builds exactly one API image group per color', () => {
    const groups = buildColorImageGroups(variants);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ colorId: '10' });
    expect(groups[0].images.map((image) => image.url)).toEqual(['/red-front.jpg', '/red-back.jpg']);
    expect(groups[1]).toMatchObject({ colorId: '20' });
    expect(groups[1].images.map((image) => image.url)).toEqual(['/blue.jpg']);
  });
});
