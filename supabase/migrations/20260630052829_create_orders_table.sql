/*
# Create orders table for Bortnikov handmade bracelet shop

1. New Tables
- `orders`
- `id` (uuid, primary key)
- `customer_name` (text, not null) - имя заказчика
- `customer_phone` (text, not null) - телефон для связи
- `bracelet_type` (text, not null) - тип плетения: "fish_tail" или "french_braid"
- `color` (text, not null) - основной цвет браслета
- `secondary_color` (text, null) - дополнительный цвет (опционально)
- `size` (text, not null) - размер запястья
- `comment` (text, null) - пожелания заказчика
- `status` (text, default 'new') - статус заказа: new, in_progress, completed, cancelled
- `created_at` (timestamp)

2. Security
- Enable RLS on `orders`.
- Allow anon + authenticated full CRUD - это магазин без авторизации, все могут делать заказы.
*/

CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    bracelet_type text NOT NULL CHECK (bracelet_type IN ('fish_tail', 'french_braid')),
    color text NOT NULL,
    secondary_color text,
    size text NOT NULL,
    comment text,
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'completed', 'cancelled')),
    created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
    TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
    TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
    TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
    TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);