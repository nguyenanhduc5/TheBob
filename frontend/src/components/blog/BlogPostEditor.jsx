import React, { useEffect, useMemo, useRef, useState } from 'react';
import { productsAPI } from '../../api/app';

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export default function BlogPostEditor({ initialData, categories, onSave, onCancel, saving }) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [summary, setSummary] = useState(initialData?.summary || '');
  const [thumbnail, setThumbnail] = useState(initialData?.thumbnail || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || '');
  const [status, setStatus] = useState(initialData?.status || 'Draft');
  const [isFeaturedHome, setIsFeaturedHome] = useState(initialData?.isFeaturedHome || false);
  const [homeDisplayOrder, setHomeDisplayOrder] = useState(initialData?.homeDisplayOrder || 0);

  const [attachedProducts, setAttachedProducts] = useState(
    initialData?.products?.map((p) => ({
      productId: p.productId,
      name: p.name,
      thumbnail: p.thumbnail,
      price: p.price,
      displayOrder: p.displayOrder ?? 0,
    })) || []
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const textareaRef = useRef(null);
  const searchWrapRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const loadProducts = async () => {
      setProductsLoading(true);
      try {
        const res = await productsAPI.getProducts();
        const items = res?.data || res || [];
        if (mounted) {
          setAllProducts(Array.isArray(items) ? items : []);
        }
      } catch (err) {
        if (mounted) setAllProducts([]);
      } finally {
        if (mounted) setProductsLoading(false);
      }
    };

    loadProducts();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const categoryMap = useMemo(() => {
    return new Map((categories || []).map((cat) => [String(cat.id), cat]));
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const q = normalizeText(searchQuery);
    const products = Array.isArray(allProducts) ? allProducts : [];
    const base = q
      ? products.filter((prod) => {
          const haystack = [
            prod.name,
            prod.sku,
            prod.categoryName,
            prod.brandName,
            prod.id,
          ]
            .map(normalizeText)
            .join(' ');
          return haystack.includes(q);
        })
      : products;

    return base.slice(0, 24);
  }, [allProducts, searchQuery]);

  const resolveBlogCategoryId = (prod) => {
    const productCategoryId = prod?.categoryId ? String(prod.categoryId) : '';
    if (productCategoryId && categoryMap.has(productCategoryId)) {
      return productCategoryId;
    }

    const productCategoryName = normalizeText(prod?.categoryName);
    if (!productCategoryName) return '';

    const matched = (categories || []).find(
      (cat) => normalizeText(cat.name) === productCategoryName
    );

    return matched ? String(matched.id) : '';
  };

  const handleAttachProduct = (prod) => {
    const pId = Number(prod.id);
    if (!pId) return;

    let alreadyAttached = false;
    setAttachedProducts((prev) => {
      alreadyAttached = prev.some((item) => item.productId === pId);
      if (alreadyAttached) {
        return prev;
      }

      return [
        ...prev,
        {
          productId: pId,
          name: prod.name,
          thumbnail: prod.thumbnail || prod.mainImageUrl || '',
          price: prod.price,
          displayOrder: prev.length + 1,
        },
      ];
    });

    if (alreadyAttached) {
      setShowSuggestions(false);
      setSearchQuery('');
      return;
    }

    const nextCategoryId = resolveBlogCategoryId(prod);
    if (nextCategoryId) {
      setCategoryId(nextCategoryId);
    }

    const placeholder = `\n[product:${pId}]\n`;
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart ?? content.length;
      const end = textarea.selectionEnd ?? content.length;
      const nextValue = `${content.slice(0, start)}${placeholder}${content.slice(end)}`;
      setContent(nextValue);

      requestAnimationFrame(() => {
        textarea.focus();
        const cursor = start + placeholder.length;
        textarea.setSelectionRange(cursor, cursor);
      });
    } else if (!content.includes(`[product:${pId}]`)) {
      setContent((prev) => `${prev}${placeholder}`);
    }

    setSearchQuery('');
    setShowSuggestions(false);
  };

  const handleRemoveAttached = (productId) => {
    setAttachedProducts((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleDisplayOrderChange = (productId, newOrder) => {
    setAttachedProducts((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, displayOrder: parseInt(newOrder, 10) || 0 }
          : item
      )
    );
  };

  const validate = () => {
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Tiêu đề không được để trống.');
      return false;
    }

    if (!content.trim()) {
      setErrorMsg('Nội dung không được để trống.');
      return false;
    }

    if (status === 'Published') {
      const placeholderRegex = /\[product:(\d+)\]/g;
      const foundProductIds = [];
      let match;
      while ((match = placeholderRegex.exec(content)) !== null) {
        const pid = parseInt(match[1], 10);
        if (!Number.isNaN(pid)) foundProductIds.push(pid);
      }

      const attachedSet = new Set(attachedProducts.map((p) => p.productId));
      const missingInAttached = foundProductIds.filter((id) => !attachedSet.has(id));

      if (missingInAttached.length > 0) {
        setErrorMsg(
          `Không thể Publish: Các mã sản phẩm [product:${missingInAttached.join(
            ', '
          )}] xuất hiện trong Content nhưng chưa có trong danh sách sản phẩm gắn kèm.`
        );
        return false;
      }
    }

    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      title: title.trim(),
      summary: summary.trim(),
      thumbnail: thumbnail.trim(),
      content,
      categoryId: categoryId ? parseInt(categoryId, 10) : null,
      status,
      isFeaturedHome,
      homeDisplayOrder: parseInt(homeDisplayOrder, 10) || 0,
      products: attachedProducts.map((p) => ({
        productId: p.productId,
        displayOrder: p.displayOrder,
      })),
    };

    onSave(payload);
  };

  return (
    <form className="blog-post-editor" onSubmit={handleSubmit}>
      <h2>{initialData ? 'Chỉnh Sửa Bài Viết' : 'Tạo Bài Viết Mới'}</h2>

      {errorMsg && <div className="editor-error-alert">{errorMsg}</div>}

      <div className="editor-form-group">
        <label>Tiêu đề (*)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nhập tiêu đề bài viết..."
          required
        />
      </div>

      <div className="editor-form-group">
        <label>Thumbnail</label>
        <input
          type="text"
          value={thumbnail}
          onChange={(e) => setThumbnail(e.target.value)}
          placeholder="URL ảnh đại diện..."
        />
        {thumbnail && (
          <div className="editor-thumbnail-preview">
            <img src={thumbnail} alt="Thumbnail preview" />
          </div>
        )}
      </div>

      <div className="editor-form-group">
        <label>Tóm tắt ngắn (Summary)</label>
        <textarea
          rows={2}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Mô tả ngắn hiển thị ở danh sách bài viết..."
        />
      </div>

      <div className="editor-form-group">
        <label>Danh mục</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">-- Chọn danh mục --</option>
          {(categories || []).map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="editor-form-group attached-products-section" ref={searchWrapRef}>
        <label>Gắn sản phẩm vào bài viết</label>
        <div className="product-search-input-wrap">
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            placeholder="Tìm hoặc gõ từ khóa để lọc sản phẩm..."
          />
          {productsLoading && <span className="search-spinner">Đang tải...</span>}
          {!productsLoading && allProducts.length > 0 && (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => {
                setSearchQuery('');
                setShowSuggestions(true);
              }}
            >
              Tất cả
            </button>
          )}
        </div>

        {showSuggestions && (
          <div className="product-search-dropdown">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  className="search-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleAttachProduct(prod)}
                >
                  <img src={prod.thumbnail || prod.mainImageUrl || '/placeholder.jpg'} alt={prod.name} />
                  <div className="search-item-meta">
                    <strong>{prod.name}</strong>
                    <span>{prod.categoryName || 'Chưa có danh mục'}</span>
                    <small>{prod.price ? `${Number(prod.price).toLocaleString('vi-VN')} VND` : '—'}</small>
                  </div>
                  <span className="btn-add-product">+ Gắn thẻ</span>
                </button>
              ))
            ) : (
              <div className="product-search-empty">Không tìm thấy sản phẩm phù hợp.</div>
            )}
          </div>
        )}

        {attachedProducts.length > 0 && (
          <div className="attached-products-list">
            <h4>Sản phẩm đã gắn ({attachedProducts.length})</h4>
            <div className="attached-products-grid">
              {attachedProducts.map((prod) => (
                <div key={prod.productId} className="attached-product-card">
                  <img src={prod.thumbnail || '/placeholder.jpg'} alt={prod.name} />
                  <div className="attached-product-details">
                    <span>{prod.name}</span>
                    <small>Tag: [product:{prod.productId}]</small>
                  </div>
                  <div className="attached-product-order">
                    <label>Thứ tự:</label>
                    <input
                      type="number"
                      value={prod.displayOrder}
                      onChange={(e) => handleDisplayOrderChange(prod.productId, e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-remove-attached"
                    onClick={() => handleRemoveAttached(prod.productId)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="editor-form-group">
        <label>Nội dung bài viết (HTML / Rich text) (*)</label>
        <div className="editor-toolbar-hint">
          Mẹo: Khi chọn sản phẩm ở trên, hệ thống sẽ tự chèn <code>[product:id]</code> vào vị trí con trỏ.
        </div>
        <textarea
          ref={textareaRef}
          rows={12}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nhập nội dung HTML bài viết tại đây..."
          required
        />
      </div>

      <div className="editor-form-row editor-featured-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isFeaturedHome}
            onChange={(e) => setIsFeaturedHome(e.target.checked)}
          />
          Hiển thị ở Bài viết nổi bật (Trang chủ)
        </label>

        {isFeaturedHome && (
          <div className="editor-form-group inline-group">
            <label>Thứ tự Trang chủ:</label>
            <input
              type="number"
              value={homeDisplayOrder}
              onChange={(e) => setHomeDisplayOrder(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="editor-form-group">
        <label>Trạng thái</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="Draft">Draft</option>
          <option value="Published">Published</option>
          <option value="Archived">Archived</option>
        </select>
      </div>

      <div className="editor-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Hủy
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu bài viết'}
        </button>
      </div>
    </form>
  );
}
