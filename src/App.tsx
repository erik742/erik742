import { useState } from 'react';
import { supabase } from './lib/supabase';
import type { OrderInsert } from './lib/supabase';
import './index.css';

const COLORS = [
  { name: 'Красный', value: '#e53935' },
  { name: 'Оранжевый', value: '#ff9800' },
  { name: 'Жёлтый', value: '#fdd835' },
  { name: 'Зелёный', value: '#43a047' },
  { name: 'Голубой', value: '#039be5' },
  { name: 'Синий', value: '#1e88e5' },
  { name: 'Фиолетовый', value: '#8e24aa' },
  { name: 'Розовый', value: '#ec407a' },
  { name: 'Чёрный', value: '#212121' },
  { name: 'Белый', value: '#f5f5f5' },
];

const SIZES = [
  'XS (14-15 см)',
  'S (15-16 см)',
  'M (16-17 см)',
  'L (17-18 см)',
  'XL (18-19 см)',
];

const BRACELET_TYPES = [
  {
    id: 'fish_tail',
    name: 'Рыбий хвост',
    icon: '~',
    description: 'Красивое плетение в виде чешуек, напоминающее рыбий хвост',
  },
  {
    id: 'french_braid',
    name: 'Французская косичка',
    icon: '~',
    description: 'Элегантное плетение французской косы, стильный аксессуар',
  },
];

function App() {
  const [formData, setFormData] = useState<OrderInsert>({
    customer_name: '',
    customer_phone: '',
    bracelet_type: 'fish_tail',
    color: '#1e88e5',
    secondary_color: null,
    size: 'M (16-17 см)',
    comment: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('orders')
        .insert([formData]);

      if (insertError) {
        throw insertError;
      }

      setIsSuccess(true);
      setFormData({
        customer_name: '',
        customer_phone: '',
        bracelet_type: 'fish_tail',
        color: '#1e88e5',
        secondary_color: null,
        size: 'M (16-17 см)',
        comment: null,
      });
    } catch (err) {
      setError('Произошла ошибка при отправке заказа. Попробуйте ещё раз.');
      console.error('Order error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToOrder = () => {
    document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="container header-content">
          <a href="/" className="logo">
            Bortnikov <span>handmade</span>
          </a>
          <nav className="nav">
            <a href="#products">Каталог</a>
            <a href="#order">Заказать</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero-badge">Ручная работа</div>
          <h1>
            Браслеты от <span>Bortnikov</span>
          </h1>
          <p className="hero-subtitle">
            Уникальные браслеты из резинок ручной работы. Два вида плетения на выбор,
            множество расцветок и размеров.
          </p>
          <div className="hero-image">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="white"/>
              <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" stroke="white"/>
            </svg>
          </div>
          <button onClick={scrollToOrder} className="btn btn-primary">
            Заказать браслет
          </button>
        </div>
      </section>

      {/* Products */}
      <section className="products" id="products">
        <div className="container">
          <div className="products-header">
            <h2>Виды плетения</h2>
            <p style={{ color: 'var(--text-light)', marginTop: '8px' }}>
              Выберите понравившийся стиль для вашего браслета
            </p>
          </div>
          <div className="products-grid">
            {BRACELET_TYPES.map((type) => (
              <div key={type.id} className="product-card animate-in">
                <div className="product-image">
                  <svg width="120" height="120" viewBox="0 0 100 20" fill="none">
                    {type.id === 'fish_tail' ? (
                      <>
                        <ellipse cx="10" cy="10" rx="8" ry="8" stroke="white" strokeWidth="2"/>
                        <ellipse cx="30" cy="10" rx="8" ry="8" stroke="white" strokeWidth="2"/>
                        <ellipse cx="50" cy="10" rx="8" ry="8" stroke="white" strokeWidth="2"/>
                        <ellipse cx="70" cy="10" rx="8" ry="8" stroke="white" strokeWidth="2"/>
                        <ellipse cx="90" cy="10" rx="8" ry="8" stroke="white" strokeWidth="2"/>
                      </>
                    ) : (
                      <>
                        <path d="M5 5 Q25 15 50 5 Q75 15 95 5" stroke="white" strokeWidth="2" fill="none"/>
                        <path d="M5 15 Q25 5 50 15 Q75 5 95 15" stroke="white" strokeWidth="2" fill="none"/>
                      </>
                    )}
                  </svg>
                </div>
                <div className="product-content">
                  <h3>{type.name}</h3>
                  <p>{type.description}</p>
                  <div className="product-price">от 500 ₽</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Order Form */}
      <section className="order-section" id="order">
        <div className="container">
          <div className="order-container">
            <div className="products-header">
              <h2>Оформить заказ</h2>
              <p style={{ color: 'var(--text-light)', marginTop: '8px' }}>
                Заполните форму, и я свяжусь с вами для уточнения деталей
              </p>
            </div>

            <div className="order-form">
              {isSuccess ? (
                <div className="success-message">
                  <div className="success-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#5a8f5a" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <h3>Заказ принят!</h3>
                  <p style={{ marginTop: '12px' }}>
                    Спасибо за ваш заказ! Я свяжусь с вами в ближайшее время.
                  </p>
                  <button
                    onClick={() => setIsSuccess(false)}
                    className="btn btn-primary"
                    style={{ marginTop: '24px' }}
                  >
                    Новый заказ
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label>Выберите тип плетения</label>
                    <div className="bracelet-types">
                      {BRACELET_TYPES.map((type) => (
                        <label
                          key={type.id}
                          className={`bracelet-type ${
                            formData.bracelet_type === type.id ? 'selected' : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name="bracelet_type"
                            value={type.id}
                            checked={formData.bracelet_type === type.id}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                bracelet_type: e.target.value as 'fish_tail' | 'french_braid',
                              }))
                            }
                          />
                          <div className="bracelet-type-icon">~</div>
                          <div className="bracelet-type-name">{type.name}</div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Основной цвет</label>
                    <div className="color-options">
                      {COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          className={`color-option ${
                            formData.color === color.value ? 'selected' : ''
                          }`}
                          style={{ backgroundColor: color.value }}
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, color: color.value }))
                          }
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Дополнительный цвет (опционально)</label>
                    <div className="color-options">
                      <button
                        type="button"
                        className={`color-option ${
                          formData.secondary_color === null ? 'selected' : ''
                        }`}
                        style={{
                          backgroundColor: '#e8e4df',
                          border: '2px dashed #ccc',
                        }}
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, secondary_color: null }))
                        }
                        title="Без дополнительного цвета"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" stroke="#999" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                      {COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          className={`color-option ${
                            formData.secondary_color === color.value ? 'selected' : ''
                          }`}
                          style={{ backgroundColor: color.value }}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              secondary_color: color.value,
                            }))
                          }
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="size">Размер запястья</label>
                    <select
                      id="size"
                      value={formData.size}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, size: e.target.value }))
                      }
                    >
                      {SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="name">Ваше имя</label>
                    <input
                      id="name"
                      type="text"
                      placeholder="Как к вам обращаться?"
                      value={formData.customer_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          customer_name: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="phone">Телефон для связи</label>
                    <input
                      id="phone"
                      type="tel"
                      placeholder="+7 (999) 123-45-67"
                      value={formData.customer_phone}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          customer_phone: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="comment">Пожелания к заказу (опционально)</label>
                    <textarea
                      id="comment"
                      placeholder="Опишите ваши пожелания..."
                      value={formData.comment || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          comment: e.target.value || null,
                        }))
                      }
                    />
                  </div>

                  {error && (
                    <p style={{ color: 'var(--error)', marginBottom: '16px' }}>{error}</p>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary btn-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="spinner"></span>
                        Отправка...
                      </>
                    ) : (
                      'Отправить заказ'
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>Bortnikov handmade — Браслеты из резинок ручной работы</p>
        </div>
      </footer>
    </>
  );
}

export default App;
