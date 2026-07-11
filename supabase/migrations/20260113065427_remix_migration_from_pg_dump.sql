CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'confirmateur',
    'stock_manager'
);


--
-- Name: customer_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.customer_status AS ENUM (
    'new',
    'regular',
    'vip',
    'blacklisted'
);


--
-- Name: delivery_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delivery_type AS ENUM (
    'home',
    'stop_desk'
);


--
-- Name: order_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_source AS ENUM (
    'facebook',
    'instagram',
    'website',
    'phone',
    'other'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'new',
    'validated',
    'confirmed',
    'cancelled',
    'failed_1',
    'failed_2',
    'failed_3',
    'no_answer',
    'wrong_number',
    'postponed',
    'to_reconfirm',
    'callback',
    'duplicate',
    'out_of_stock',
    'shipped',
    'delivered',
    'returned',
    'exchange',
    'ready',
    'preparing',
    'delivered_paid',
    'delivery_failed'
);


--
-- Name: generate_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Use gen_random_uuid() for crypto-secure randomness
  NEW.order_number = 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
    UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 8));
  RETURN NEW;
END;
$$;


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: is_app_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_app_user(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = _user_id AND is_approved = true
    )
$$;


--
-- Name: log_order_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_order_status_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_history (order_id, old_status, new_status, changed_by, changed_by_user_id)
    VALUES (
      NEW.id, 
      OLD.status, 
      NEW.status, 
      NEW.assigned_agent,  -- Keep for display purposes
      auth.uid()           -- Store actual authenticated user for audit integrity
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    wilaya text NOT NULL,
    commune text,
    address text,
    total_orders integer DEFAULT 0 NOT NULL,
    total_spent numeric DEFAULT 0 NOT NULL,
    last_order_date timestamp with time zone,
    status public.customer_status DEFAULT 'new'::public.customer_status NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT positive_customer_values CHECK (((total_orders >= 0) AND (total_spent >= (0)::numeric)))
);


--
-- Name: order_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    old_status public.order_status,
    new_status public.order_status NOT NULL,
    changed_by text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by_user_id uuid
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    product_name text NOT NULL,
    variant text,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT positive_quantity CHECK ((quantity > 0)),
    CONSTRAINT positive_unit_price CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number text NOT NULL,
    customer_id uuid,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    customer_address text NOT NULL,
    wilaya text NOT NULL,
    commune text,
    total_price numeric DEFAULT 0 NOT NULL,
    delivery_fee numeric DEFAULT 0 NOT NULL,
    status public.order_status DEFAULT 'new'::public.order_status NOT NULL,
    source public.order_source DEFAULT 'other'::public.order_source NOT NULL,
    assigned_agent text,
    notes text,
    tracking_number text,
    delivery_company text,
    confirmed_at timestamp with time zone,
    shipped_at timestamp with time zone,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    delivery_type public.delivery_type DEFAULT 'home'::public.delivery_type NOT NULL,
    discount numeric DEFAULT 0 NOT NULL,
    CONSTRAINT positive_order_prices CHECK (((total_price >= (0)::numeric) AND (delivery_fee >= (0)::numeric)))
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    variant_type text NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_variants_variant_type_check CHECK ((variant_type = ANY (ARRAY['size'::text, 'color'::text])))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    purchase_price numeric DEFAULT 0 NOT NULL,
    selling_price numeric DEFAULT 0 NOT NULL,
    current_stock integer DEFAULT 0 NOT NULL,
    reserved_stock integer DEFAULT 0 NOT NULL,
    reorder_level integer DEFAULT 10 NOT NULL,
    barcode text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT positive_prices CHECK (((selling_price >= (0)::numeric) AND (purchase_price >= (0)::numeric))),
    CONSTRAINT positive_stock CHECK (((current_stock >= 0) AND (reserved_stock >= 0)))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_approved boolean DEFAULT false,
    avatar_url text
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: order_history order_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_history
    ADD CONSTRAINT order_history_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: orders log_order_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER log_order_status AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();


--
-- Name: orders set_order_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: order_history order_history_changed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_history
    ADD CONSTRAINT order_history_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES auth.users(id);


--
-- Name: order_history order_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_history
    ADD CONSTRAINT order_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (user_id = auth.uid())));


--
-- Name: customers App users can delete customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can delete customers" ON public.customers FOR DELETE TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: order_items App users can delete order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can delete order items" ON public.order_items FOR DELETE TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: orders App users can delete orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can delete orders" ON public.orders FOR DELETE TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: product_variants App users can delete product variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can delete product variants" ON public.product_variants FOR DELETE TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: products App users can delete products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can delete products" ON public.products FOR DELETE TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: customers App users can insert customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_app_user(auth.uid()));


--
-- Name: order_history App users can insert order history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can insert order history" ON public.order_history FOR INSERT TO authenticated WITH CHECK (public.is_app_user(auth.uid()));


--
-- Name: order_items App users can insert order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can insert order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (public.is_app_user(auth.uid()));


--
-- Name: orders App users can insert orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (public.is_app_user(auth.uid()));


--
-- Name: product_variants App users can insert product variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can insert product variants" ON public.product_variants FOR INSERT TO authenticated WITH CHECK (public.is_app_user(auth.uid()));


--
-- Name: products App users can insert products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_app_user(auth.uid()));


--
-- Name: customers App users can update customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can update customers" ON public.customers FOR UPDATE TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: order_items App users can update order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can update order items" ON public.order_items FOR UPDATE TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: orders App users can update orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can update orders" ON public.orders FOR UPDATE TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: product_variants App users can update product variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can update product variants" ON public.product_variants FOR UPDATE TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: products App users can update products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can update products" ON public.products FOR UPDATE TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: customers App users can view customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can view customers" ON public.customers FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: order_history App users can view order history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can view order history" ON public.order_history FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: order_items App users can view order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can view order items" ON public.order_items FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: orders App users can view orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can view orders" ON public.orders FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: product_variants App users can view product variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can view product variants" ON public.product_variants FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: products App users can view products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "App users can view products" ON public.products FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));


--
-- Name: order_history Prevent deletion of order history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Prevent deletion of order history" ON public.order_history FOR DELETE TO authenticated USING (false);


--
-- Name: profiles Users can update profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update profiles" ON public.profiles FOR UPDATE TO authenticated USING (((id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: profiles Users can view profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: order_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: product_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;