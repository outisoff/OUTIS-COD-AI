-- Consolidated migration for external Supabase project
-- Generated Mon Jul 13 17:30:15 UTC 2026 — run this in the Supabase SQL Editor
-- Contains all 181 migrations in chronological order


-- ============================================================
-- BEGIN 20260113065427_remix_migration_from_pg_dump.sql
-- ============================================================
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

-- ============================================================
-- BEGIN 20260113071052_c6b28347-b6ac-42ee-9a57-e1760aafbd0f.sql
-- ============================================================
-- Tighten profile update checks to prevent self-approval and add missing INSERT policy

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Prevent non-admin users from setting is_approved=true on UPDATE
ALTER POLICY "Users can update profiles"
ON public.profiles
USING (
  (id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  (
    id = auth.uid()
    AND coalesce(is_approved, false) = false
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Allow users to create their own profile row (but never approved on insert)
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
  AND coalesce(is_approved, false) = false
);


-- ============================================================
-- BEGIN 20260114100250_4e905b5b-eeb9-41a5-9778-8d1c685d2442.sql
-- ============================================================
-- Create integrations table to store API keys and settings
CREATE TABLE public.integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_type text NOT NULL,
  name text NOT NULL,
  api_key text,
  api_secret text,
  webhook_url text,
  spreadsheet_id text,
  store_url text,
  is_enabled boolean NOT NULL DEFAULT false,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(integration_type, name)
);

-- Enable RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage integrations
CREATE POLICY "Admins can view integrations"
ON public.integrations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert integrations"
ON public.integrations
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update integrations"
ON public.integrations
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete integrations"
ON public.integrations
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_integrations_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- BEGIN 20260114105344_baff4783-a8fd-4256-a4d1-a3a916311b7c.sql
-- ============================================================
-- Create table to store Google OAuth tokens for users
CREATE TABLE public.google_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tokens
CREATE POLICY "Users can view their own Google tokens"
ON public.google_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "Users can insert their own Google tokens"
ON public.google_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "Users can update their own Google tokens"
ON public.google_tokens
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "Users can delete their own Google tokens"
ON public.google_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_google_tokens_updated_at
BEFORE UPDATE ON public.google_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- BEGIN 20260118101940_26419bd0-4500-47f1-9d3e-28a0f153103d.sql
-- ============================================================
-- Remove client-side SELECT access to google_tokens
-- Tokens should only be accessed server-side via edge functions

-- Drop existing RLS policies for google_tokens
DROP POLICY IF EXISTS "Users can view their own Google tokens" ON public.google_tokens;
DROP POLICY IF EXISTS "Users can insert their own Google tokens" ON public.google_tokens;
DROP POLICY IF EXISTS "Users can update their own Google tokens" ON public.google_tokens;
DROP POLICY IF EXISTS "Users can delete their own Google tokens" ON public.google_tokens;

-- Create new restrictive policies
-- No SELECT policy for users - tokens should only be accessed server-side via service role
-- This prevents client-side JavaScript from querying tokens

-- Deny all client-side SELECT access
CREATE POLICY "No direct SELECT access to tokens"
ON public.google_tokens FOR SELECT
USING (false);

-- Deny client-side INSERT - tokens are saved by edge functions with service role
CREATE POLICY "No direct INSERT access to tokens"
ON public.google_tokens FOR INSERT
WITH CHECK (false);

-- Deny client-side UPDATE - tokens are updated by edge functions with service role
CREATE POLICY "No direct UPDATE access to tokens"
ON public.google_tokens FOR UPDATE
USING (false);

-- Deny client-side DELETE - tokens are deleted by edge functions with service role
CREATE POLICY "No direct DELETE access to tokens"
ON public.google_tokens FOR DELETE
USING (false);

-- Update customers table RLS to be more restrictive based on role
-- First, create a helper function to check if user has specific roles

-- Drop existing customer policies
DROP POLICY IF EXISTS "App users can view customers" ON public.customers;
DROP POLICY IF EXISTS "App users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "App users can update customers" ON public.customers;
DROP POLICY IF EXISTS "App users can delete customers" ON public.customers;

-- Create role-based customer access policies
-- Admins have full access to all customers
CREATE POLICY "Admins can view all customers"
ON public.customers FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Confirmateurs can view customers for orders they're working on
CREATE POLICY "Confirmateurs can view customers"
ON public.customers FOR SELECT
USING (
  has_role(auth.uid(), 'confirmateur') AND
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.customer_id = customers.id
  )
);

-- Admins can insert customers
CREATE POLICY "Admins can insert customers"
ON public.customers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Confirmateurs can insert customers (when creating orders)
CREATE POLICY "Confirmateurs can insert customers"
ON public.customers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'confirmateur'));

-- Admins can update any customer
CREATE POLICY "Admins can update customers"
ON public.customers FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Confirmateurs can update customers they have orders for
CREATE POLICY "Confirmateurs can update customers"
ON public.customers FOR UPDATE
USING (
  has_role(auth.uid(), 'confirmateur') AND
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.customer_id = customers.id
  )
);

-- Only admins can delete customers
CREATE POLICY "Admins can delete customers"
ON public.customers FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- ============================================================
-- BEGIN 20260118152411_c781cb4a-60c5-4b92-9348-5da48b541ca6.sql
-- ============================================================
-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- BEGIN 20260118204844_bc5a9cae-81e5-4bae-9b7a-8efc469d8412.sql
-- ============================================================
-- Add FK constraints so orders can embed order_items and ensure data integrity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_order_id_fkey'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_order_id_fkey
      FOREIGN KEY (order_id)
      REFERENCES public.orders(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_product_id_fkey'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_product_id_fkey
      FOREIGN KEY (product_id)
      REFERENCES public.products(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);


-- ============================================================
-- BEGIN 20260119163621_bd7ebfcb-09f3-49b6-8b27-b4ec4c4218a9.sql
-- ============================================================
-- Create delivery_fees table to store delivery prices per wilaya
CREATE TABLE public.delivery_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wilaya_code text NOT NULL UNIQUE,
  wilaya_name text NOT NULL,
  home_delivery_fee numeric NOT NULL DEFAULT 0,
  stop_desk_fee numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "App users can view delivery fees"
ON public.delivery_fees FOR SELECT
USING (is_app_user(auth.uid()));

CREATE POLICY "Admins can insert delivery fees"
ON public.delivery_fees FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update delivery fees"
ON public.delivery_fees FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete delivery fees"
ON public.delivery_fees FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_delivery_fees_updated_at
BEFORE UPDATE ON public.delivery_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default fees for all 58 wilayas
INSERT INTO public.delivery_fees (wilaya_code, wilaya_name, home_delivery_fee, stop_desk_fee) VALUES
('1', 'Adrar', 900, 600),
('2', 'Chlef', 600, 400),
('3', 'Laghouat', 800, 500),
('4', 'Oum El Bouaghi', 700, 450),
('5', 'Batna', 700, 450),
('6', 'Béjaïa', 600, 400),
('7', 'Biskra', 750, 500),
('8', 'Béchar', 900, 600),
('9', 'Blida', 500, 350),
('10', 'Bouira', 550, 400),
('11', 'Tamanrasset', 1200, 800),
('12', 'Tébessa', 750, 500),
('13', 'Tlemcen', 650, 450),
('14', 'Tiaret', 650, 450),
('15', 'Tizi Ouzou', 550, 400),
('16', 'Alger', 400, 300),
('17', 'Djelfa', 700, 450),
('18', 'Jijel', 650, 450),
('19', 'Sétif', 600, 400),
('20', 'Saïda', 700, 450),
('21', 'Skikda', 650, 450),
('22', 'Sidi Bel Abbès', 650, 450),
('23', 'Annaba', 600, 400),
('24', 'Guelma', 650, 450),
('25', 'Constantine', 550, 400),
('26', 'Médéa', 550, 400),
('27', 'Mostaganem', 600, 400),
('28', 'M''Sila', 700, 450),
('29', 'Mascara', 650, 450),
('30', 'Ouargla', 850, 550),
('31', 'Oran', 500, 350),
('32', 'El Bayadh', 850, 550),
('33', 'Illizi', 1200, 800),
('34', 'Bordj Bou Arréridj', 600, 400),
('35', 'Boumerdès', 500, 350),
('36', 'El Tarf', 700, 450),
('37', 'Tindouf', 1200, 800),
('38', 'Tissemsilt', 700, 450),
('39', 'El Oued', 800, 550),
('40', 'Khenchela', 750, 500),
('41', 'Souk Ahras', 700, 450),
('42', 'Tipaza', 500, 350),
('43', 'Mila', 650, 450),
('44', 'Aïn Defla', 550, 400),
('45', 'Naâma', 850, 550),
('46', 'Aïn Témouchent', 600, 400),
('47', 'Ghardaïa', 850, 550),
('48', 'Relizane', 600, 400),
('49', 'El M''Ghair', 850, 550),
('50', 'El Meniaa', 900, 600),
('51', 'Ouled Djellal', 800, 550),
('52', 'Bordj Badji Mokhtar', 1200, 800),
('53', 'Béni Abbès', 1000, 700),
('54', 'Timimoun', 1000, 700),
('55', 'Touggourt', 800, 550),
('56', 'Djanet', 1200, 800),
('57', 'In Salah', 1100, 750),
('58', 'In Guezzam', 1200, 800);

-- ============================================================
-- BEGIN 20260119165505_b71c2444-26d1-452b-ac36-c2a08b7b4ffe.sql
-- ============================================================
-- Add free_delivery column to products table
ALTER TABLE public.products 
ADD COLUMN free_delivery boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.products.free_delivery IS 'If true, orders containing this product get free delivery';

-- ============================================================
-- BEGIN 20260123211210_54177839-1169-4826-aff4-7a38d5b99155.sql
-- ============================================================
-- Add 'at_station' to the order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'at_station' AFTER 'ready';

-- ============================================================
-- BEGIN 20260125235308_1f92b9b2-6cbe-4034-94c0-3a9637a7758b.sql
-- ============================================================
-- Create table for delivery company fees per wilaya
CREATE TABLE public.delivery_company_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_company TEXT NOT NULL,
  wilaya_code TEXT NOT NULL,
  wilaya_name TEXT NOT NULL,
  home_delivery_fee NUMERIC NOT NULL DEFAULT 0,
  stop_desk_fee NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(delivery_company, wilaya_code)
);

-- Enable RLS
ALTER TABLE public.delivery_company_fees ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can delete delivery company fees" 
ON public.delivery_company_fees 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert delivery company fees" 
ON public.delivery_company_fees 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update delivery company fees" 
ON public.delivery_company_fees 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view delivery company fees" 
ON public.delivery_company_fees 
FOR SELECT 
USING (is_app_user(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_delivery_company_fees_updated_at
BEFORE UPDATE ON public.delivery_company_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- BEGIN 20260125235706_147c25ef-6088-4037-b8fb-28af139cf946.sql
-- ============================================================
-- Create table for temporary delivery promotions
CREATE TABLE public.delivery_promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  applies_to TEXT NOT NULL CHECK (applies_to IN ('all', 'home', 'stop_desk')),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_promotions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for delivery_promotions
CREATE POLICY "Admins can delete delivery promotions" 
ON public.delivery_promotions FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert delivery promotions" 
ON public.delivery_promotions FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update delivery promotions" 
ON public.delivery_promotions FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view delivery promotions" 
ON public.delivery_promotions FOR SELECT 
USING (is_app_user(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_delivery_promotions_updated_at
BEFORE UPDATE ON public.delivery_promotions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add product-specific delivery fees columns to products table
ALTER TABLE public.products 
ADD COLUMN custom_home_delivery_fee NUMERIC DEFAULT NULL,
ADD COLUMN custom_stop_desk_fee NUMERIC DEFAULT NULL;

-- ============================================================
-- BEGIN 20260126001442_9f38ba54-5427-4bad-a84f-9ee0cc04807c.sql
-- ============================================================
-- Create a second special delivery fees table
CREATE TABLE public.special_delivery_fees_2 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wilaya_code TEXT NOT NULL,
  wilaya_name TEXT NOT NULL,
  home_delivery_fee NUMERIC NOT NULL DEFAULT 0,
  stop_desk_fee NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(wilaya_code)
);

-- Enable RLS
ALTER TABLE public.special_delivery_fees_2 ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "App users can view special delivery fees 2" 
ON public.special_delivery_fees_2 
FOR SELECT 
USING (is_app_user(auth.uid()));

CREATE POLICY "Admins can insert special delivery fees 2" 
ON public.special_delivery_fees_2 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update special delivery fees 2" 
ON public.special_delivery_fees_2 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete special delivery fees 2" 
ON public.special_delivery_fees_2 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_special_delivery_fees_2_updated_at
BEFORE UPDATE ON public.special_delivery_fees_2
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- BEGIN 20260126003112_ce03fcc0-ce55-4620-830c-2cf62bf57175.sql
-- ============================================================
-- Add delivery pricing tier to products
ALTER TABLE public.products 
ADD COLUMN delivery_pricing_tier TEXT NOT NULL DEFAULT 'standard';

-- Add comment for documentation
COMMENT ON COLUMN public.products.delivery_pricing_tier IS 'Delivery pricing tier: standard, special_1, special_2, or free';

-- ============================================================
-- BEGIN 20260209083244_95b37232-f514-40a4-932f-350734a2ad0f.sql
-- ============================================================
-- Create enum for stock movement types
CREATE TYPE public.stock_movement_type AS ENUM ('entry', 'exit', 'adjustment', 'sale', 'return');

-- Create stock_movements table to track all stock changes
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason TEXT,
  reference TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Create policies for stock_movements
CREATE POLICY "Admins can view all stock movements"
ON public.stock_movements
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Stock managers can view stock movements"
ON public.stock_movements
FOR SELECT
USING (has_role(auth.uid(), 'stock_manager'::app_role));

CREATE POLICY "Admins can insert stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Stock managers can insert stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'stock_manager'::app_role));

-- Create index for better query performance
CREATE INDEX idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_created_at ON public.stock_movements(created_at DESC);

-- ============================================================
-- BEGIN 20260209085304_4b5c3020-8684-4ce1-8fe6-568ecc87d3ae.sql
-- ============================================================
-- Add purchase_price column to stock_movements for tracking entry prices
ALTER TABLE public.stock_movements 
ADD COLUMN purchase_price numeric DEFAULT NULL;

-- Add average_purchase_price column to products for storing calculated average
ALTER TABLE public.products 
ADD COLUMN average_purchase_price numeric DEFAULT 0;

-- ============================================================
-- BEGIN 20260209091127_7641f43d-b3b7-4ee1-bd5d-b40b2183518d.sql
-- ============================================================
-- Function to handle stock reservation when order status changes
CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  product RECORD;
  movement_type stock_movement_type;
BEGIN
  -- When order moves to "preparing" status, reserve stock
  IF NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status != 'preparing') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT * INTO product FROM products WHERE id = item.product_id;
        IF product.id IS NOT NULL THEN
          -- Reserve stock: decrease current_stock, increase reserved_stock
          UPDATE products
          SET 
            current_stock = current_stock - item.quantity,
            reserved_stock = reserved_stock + item.quantity,
            updated_at = now()
          WHERE id = item.product_id;
          
          -- Log the movement
          INSERT INTO stock_movements (
            product_id, movement_type, quantity, previous_stock, new_stock, 
            reason, reference, created_by
          ) VALUES (
            item.product_id,
            'exit',
            item.quantity,
            product.current_stock,
            product.current_stock - item.quantity,
            'Réservation pour commande en préparation',
            NEW.order_number,
            auth.uid()
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is delivered, finalize the sale (reduce reserved stock)
  IF (NEW.status = 'delivered' OR NEW.status = 'delivered_paid') 
     AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT * INTO product FROM products WHERE id = item.product_id;
        IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
          -- Finalize: just decrease reserved_stock (current_stock already reduced)
          UPDATE products
          SET 
            reserved_stock = reserved_stock - item.quantity,
            updated_at = now()
          WHERE id = item.product_id;
          
          -- Log as sale
          INSERT INTO stock_movements (
            product_id, movement_type, quantity, previous_stock, new_stock, 
            reason, reference, created_by
          ) VALUES (
            item.product_id,
            'sale',
            item.quantity,
            product.current_stock,
            product.current_stock,
            'Vente finalisée - Commande livrée',
            NEW.order_number,
            auth.uid()
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is cancelled or returned, restore stock
  IF NEW.status IN ('cancelled', 'returned') 
     AND OLD.status NOT IN ('cancelled', 'returned', 'new') THEN
    -- Only restore if it was previously reserved (was in preparing or beyond)
    IF OLD.status IN ('preparing', 'ready', 'at_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            -- Restore stock: increase current_stock, decrease reserved_stock
            UPDATE products
            SET 
              current_stock = current_stock + item.quantity,
              reserved_stock = GREATEST(0, reserved_stock - item.quantity),
              updated_at = now()
            WHERE id = item.product_id;
            
            -- Log as return
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id,
              'return',
              item.quantity,
              product.current_stock,
              product.current_stock + item.quantity,
              CASE WHEN NEW.status = 'cancelled' THEN 'Annulation commande' ELSE 'Retour commande' END,
              NEW.order_number,
              auth.uid()
            );
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS sync_order_stock ON orders;
CREATE TRIGGER sync_order_stock
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_stock_sync();

-- ============================================================
-- BEGIN 20260209102026_363969c4-2e3f-4d9b-bf05-544d320b36e1.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  product RECORD;
  movement_type stock_movement_type;
BEGIN
  -- When order moves to "preparing" status, reserve stock
  IF NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status != 'preparing') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT * INTO product FROM products WHERE id = item.product_id;
        IF product.id IS NOT NULL THEN
          -- Reserve stock: decrease current_stock, increase reserved_stock
          UPDATE products
          SET 
            current_stock = current_stock - item.quantity,
            reserved_stock = reserved_stock + item.quantity,
            updated_at = now()
          WHERE id = item.product_id;
          
          -- Log the movement
          INSERT INTO stock_movements (
            product_id, movement_type, quantity, previous_stock, new_stock, 
            reason, reference, created_by
          ) VALUES (
            item.product_id,
            'exit',
            item.quantity,
            product.current_stock,
            product.current_stock - item.quantity,
            'Réservation pour commande en préparation',
            NEW.order_number,
            auth.uid()
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is delivered, finalize the sale (reduce reserved stock)
  IF (NEW.status = 'delivered' OR NEW.status = 'delivered_paid') 
     AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT * INTO product FROM products WHERE id = item.product_id;
        IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
          -- Finalize: just decrease reserved_stock (current_stock already reduced)
          UPDATE products
          SET 
            reserved_stock = reserved_stock - item.quantity,
            updated_at = now()
          WHERE id = item.product_id;
          
          -- Log as sale
          INSERT INTO stock_movements (
            product_id, movement_type, quantity, previous_stock, new_stock, 
            reason, reference, created_by
          ) VALUES (
            item.product_id,
            'sale',
            item.quantity,
            product.current_stock,
            product.current_stock,
            'Vente finalisée - Commande livrée',
            NEW.order_number,
            auth.uid()
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is cancelled, restore stock from reserved to available
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Only restore if it was previously reserved (was in preparing or beyond)
    IF OLD.status IN ('preparing', 'ready', 'at_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            -- Restore stock: increase current_stock, decrease reserved_stock
            UPDATE products
            SET 
              current_stock = current_stock + item.quantity,
              reserved_stock = GREATEST(0, reserved_stock - item.quantity),
              updated_at = now()
            WHERE id = item.product_id;
            
            -- Log as return
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id,
              'return',
              item.quantity,
              product.current_stock,
              product.current_stock + item.quantity,
              'Annulation commande',
              NEW.order_number,
              auth.uid()
            );
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- When order is returned (non-delivered order coming back), restore reserved to available
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    -- Only restore if it was previously reserved (was in preparing, ready, at_station, or shipped)
    IF OLD.status IN ('preparing', 'ready', 'at_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            -- Restore stock: move from reserved back to available
            UPDATE products
            SET 
              current_stock = current_stock + item.quantity,
              reserved_stock = GREATEST(0, reserved_stock - item.quantity),
              updated_at = now()
            WHERE id = item.product_id;
            
            -- Log as return
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id,
              'return',
              item.quantity,
              product.current_stock,
              product.current_stock + item.quantity,
              'Retour commande non livrée',
              NEW.order_number,
              auth.uid()
            );
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260209104134_c72a984d-b5d0-47ef-adbd-a71f637eb830.sql
-- ============================================================
-- Fix: Make handle_order_stock_sync() idempotent by checking existing movements
CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  product RECORD;
BEGIN
  -- When order moves to "preparing" status, reserve stock (IDEMPOTENT)
  IF NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status != 'preparing') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        -- Check if already reserved for this order
        IF NOT EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'exit'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock - item.quantity,
              reserved_stock = reserved_stock + item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'exit', item.quantity, product.current_stock,
              product.current_stock - item.quantity,
              'Réservation pour commande en préparation', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is delivered, finalize the sale (IDEMPOTENT)
  IF (NEW.status = 'delivered' OR NEW.status = 'delivered_paid') 
     AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        -- Check if sale already recorded
        IF NOT EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
            UPDATE products
            SET 
              reserved_stock = reserved_stock - item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'sale', item.quantity, product.current_stock,
              product.current_stock, 'Vente finalisée - Commande livrée', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is cancelled, restore stock (IDEMPOTENT)
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF OLD.status IN ('preparing', 'ready', 'at_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          -- Check if return already recorded
          IF NOT EXISTS (
            SELECT 1 FROM stock_movements 
            WHERE reference = NEW.order_number 
              AND product_id = item.product_id 
              AND movement_type = 'return'
          ) THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Annulation commande', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- When order is returned (IDEMPOTENT)
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    IF OLD.status IN ('preparing', 'ready', 'at_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM stock_movements 
            WHERE reference = NEW.order_number 
              AND product_id = item.product_id 
              AND movement_type = 'return'
          ) THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Retour commande non livrée', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix data: Reset reserved_stock to correct value for LINT-RG-DZ
UPDATE products 
SET reserved_stock = 6, updated_at = now() 
WHERE sku = 'LINT-RG-DZ';

-- ============================================================
-- BEGIN 20260209104511_77e4337e-3679-4c3f-8f00-aafe7e8f8f0e.sql
-- ============================================================
-- Add handling for orders going back to confirmed status (restore stock)
CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  product RECORD;
BEGIN
  -- When order moves to "preparing" status, reserve stock (IDEMPOTENT)
  IF NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status != 'preparing') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'exit'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock - item.quantity,
              reserved_stock = reserved_stock + item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'exit', item.quantity, product.current_stock,
              product.current_stock - item.quantity,
              'Réservation pour commande en préparation', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order goes BACK to confirmed from preparation stages, restore stock
  IF NEW.status = 'confirmed' AND OLD.status IN ('preparing', 'ready', 'at_station') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        -- Check if exit movement exists (stock was reserved)
        IF EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'exit'
        ) AND NOT EXISTS (
          -- And no return already recorded for this rollback
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'return'
            AND reason = 'Retour au statut confirmé'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            -- Restore stock: move from reserved back to available
            UPDATE products
            SET 
              current_stock = current_stock + item.quantity,
              reserved_stock = GREATEST(0, reserved_stock - item.quantity),
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'return', item.quantity, product.current_stock,
              product.current_stock + item.quantity,
              'Retour au statut confirmé', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is delivered, finalize the sale (IDEMPOTENT)
  IF (NEW.status = 'delivered' OR NEW.status = 'delivered_paid') 
     AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
            UPDATE products
            SET 
              reserved_stock = reserved_stock - item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'sale', item.quantity, product.current_stock,
              product.current_stock, 'Vente finalisée - Commande livrée', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is cancelled, restore stock (IDEMPOTENT)
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF OLD.status IN ('preparing', 'ready', 'at_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM stock_movements 
            WHERE reference = NEW.order_number 
              AND product_id = item.product_id 
              AND movement_type = 'return'
          ) THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Annulation commande', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- When order is returned (IDEMPOTENT)
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    IF OLD.status IN ('preparing', 'ready', 'at_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM stock_movements 
            WHERE reference = NEW.order_number 
              AND product_id = item.product_id 
              AND movement_type = 'return'
          ) THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Retour commande non livrée', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- BEGIN 20260209170734_06f82a64-2de6-40f1-918a-1c154e045c58.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  product RECORD;
  last_movement_type TEXT;
BEGIN
  -- When order moves to "preparing" status, reserve stock (IDEMPOTENT)
  IF NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status != 'preparing') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        -- Check the last movement for this order+product to determine if we need to reserve
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number 
          AND sm.product_id = item.product_id 
          AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC
        LIMIT 1;

        -- Reserve if: no movement exists yet, OR last movement was a return (stock was restored)
        IF last_movement_type IS NULL OR last_movement_type = 'return' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock - item.quantity,
              reserved_stock = reserved_stock + item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'exit', item.quantity, product.current_stock,
              product.current_stock - item.quantity,
              'Réservation pour commande en préparation', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order goes BACK to confirmed from preparation stages, restore stock
  IF NEW.status = 'confirmed' AND OLD.status IN ('preparing', 'ready', 'at_station') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        -- Check last movement: only restore if last was an exit (stock is currently reserved)
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number 
          AND sm.product_id = item.product_id 
          AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC
        LIMIT 1;

        IF last_movement_type = 'exit' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock + item.quantity,
              reserved_stock = GREATEST(0, reserved_stock - item.quantity),
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'return', item.quantity, product.current_stock,
              product.current_stock + item.quantity,
              'Retour au statut confirmé', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is delivered, finalize the sale (IDEMPOTENT)
  IF (NEW.status = 'delivered' OR NEW.status = 'delivered_paid') 
     AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
            UPDATE products
            SET 
              reserved_stock = reserved_stock - item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'sale', item.quantity, product.current_stock,
              product.current_stock, 'Vente finalisée - Commande livrée', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is cancelled, restore stock (IDEMPOTENT)
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF OLD.status IN ('preparing', 'ready', 'at_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Annulation commande', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- When order is returned (IDEMPOTENT)
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    IF OLD.status IN ('preparing', 'ready', 'at_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Retour commande non livrée', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260209174747_51b90af5-eb93-4cfb-9296-1e5183605d49.sql
-- ============================================================

-- Rename the enum value from 'delivery_failed' to 'erreur'
ALTER TYPE public.order_status RENAME VALUE 'delivery_failed' TO 'erreur';

-- Update any existing orders with this status
UPDATE public.orders SET status = 'erreur' WHERE status = 'erreur';


-- ============================================================
-- BEGIN 20260210101752_a1744016-0255-4c84-9047-df9c7e1a7848.sql
-- ============================================================

-- Step 1: Add new enum values only
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'to_station';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'au_bureau';


-- ============================================================
-- BEGIN 20260210102114_beae3912-fdcc-4f3f-8636-f7ee4b741776.sql
-- ============================================================

-- Update the stock sync trigger to use to_station instead of at_station for expedition flow
CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  product RECORD;
  last_movement_type TEXT;
BEGIN
  -- When order moves to "preparing" status, reserve stock (IDEMPOTENT)
  IF NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status != 'preparing') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number 
          AND sm.product_id = item.product_id 
          AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC
        LIMIT 1;

        IF last_movement_type IS NULL OR last_movement_type = 'return' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock - item.quantity,
              reserved_stock = reserved_stock + item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'exit', item.quantity, product.current_stock,
              product.current_stock - item.quantity,
              'Réservation pour commande en préparation', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order goes BACK to confirmed from preparation stages, restore stock
  IF NEW.status = 'confirmed' AND OLD.status IN ('preparing', 'ready', 'to_station') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number 
          AND sm.product_id = item.product_id 
          AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC
        LIMIT 1;

        IF last_movement_type = 'exit' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock + item.quantity,
              reserved_stock = GREATEST(0, reserved_stock - item.quantity),
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'return', item.quantity, product.current_stock,
              product.current_stock + item.quantity,
              'Retour au statut confirmé', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is delivered, finalize the sale (IDEMPOTENT)
  IF (NEW.status = 'delivered' OR NEW.status = 'delivered_paid') 
     AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
            UPDATE products
            SET 
              reserved_stock = reserved_stock - item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'sale', item.quantity, product.current_stock,
              product.current_stock, 'Vente finalisée - Commande livrée', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is cancelled, restore stock (IDEMPOTENT)
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF OLD.status IN ('preparing', 'ready', 'to_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Annulation commande', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- When order is returned (IDEMPOTENT)
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    IF OLD.status IN ('preparing', 'ready', 'to_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Retour commande non livrée', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260210104528_421d0d40-06f7-49d3-8d62-924ac99c4b30.sql
-- ============================================================
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'Échec_de_livraison';

-- ============================================================
-- BEGIN 20260210111519_07c52b0c-2331-491e-87dc-170d01df23d6.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  product RECORD;
  last_movement_type TEXT;
BEGIN
  -- When order moves to "preparing" status, reserve stock (IDEMPOTENT)
  IF NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status != 'preparing') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number 
          AND sm.product_id = item.product_id 
          AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC
        LIMIT 1;

        IF last_movement_type IS NULL OR last_movement_type = 'return' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock - item.quantity,
              reserved_stock = reserved_stock + item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'exit', item.quantity, product.current_stock,
              product.current_stock - item.quantity,
              'Réservation pour commande en préparation', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order goes BACK to confirmed from preparation stages, restore stock
  IF NEW.status = 'confirmed' AND OLD.status IN ('preparing', 'ready', 'to_station') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number 
          AND sm.product_id = item.product_id 
          AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC
        LIMIT 1;

        IF last_movement_type = 'exit' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock + item.quantity,
              reserved_stock = GREATEST(0, reserved_stock - item.quantity),
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'return', item.quantity, product.current_stock,
              product.current_stock + item.quantity,
              'Retour au statut confirmé', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is delivered, finalize the sale (IDEMPOTENT)
  IF (NEW.status = 'delivered' OR NEW.status = 'delivered_paid') 
     AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
            UPDATE products
            SET 
              reserved_stock = reserved_stock - item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'sale', item.quantity, product.current_stock,
              product.current_stock, 'Vente finalisée - Commande livrée', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is cancelled, restore stock (IDEMPOTENT)
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF OLD.status IN ('preparing', 'ready', 'to_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Annulation commande', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- When order is returned (IDEMPOTENT)
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    IF OLD.status IN ('preparing', 'ready', 'to_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Retour commande non livrée', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- When order has delivery failure (Échec_de_livraison), restore stock (IDEMPOTENT)
  IF NEW.status = 'Échec_de_livraison' AND OLD.status != 'Échec_de_livraison' THEN
    IF OLD.status IN ('preparing', 'ready', 'to_station', 'shipped', 'at_station', 'au_bureau') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Échec de livraison', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- BEGIN 20260210111750_72b3d245-d26c-4e63-8c52-93f8b4906bc7.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  product RECORD;
  last_movement_type TEXT;
BEGIN
  -- When order moves to "preparing" status, reserve stock (IDEMPOTENT)
  IF NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status != 'preparing') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number 
          AND sm.product_id = item.product_id 
          AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC
        LIMIT 1;

        IF last_movement_type IS NULL OR last_movement_type = 'return' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock - item.quantity,
              reserved_stock = reserved_stock + item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'exit', item.quantity, product.current_stock,
              product.current_stock - item.quantity,
              'Réservation pour commande en préparation', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order goes BACK to confirmed from preparation stages, restore stock
  IF NEW.status = 'confirmed' AND OLD.status IN ('preparing', 'ready', 'to_station') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number 
          AND sm.product_id = item.product_id 
          AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC
        LIMIT 1;

        IF last_movement_type = 'exit' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock + item.quantity,
              reserved_stock = GREATEST(0, reserved_stock - item.quantity),
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'return', item.quantity, product.current_stock,
              product.current_stock + item.quantity,
              'Retour au statut confirmé', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is delivered, finalize the sale (IDEMPOTENT)
  IF (NEW.status = 'delivered' OR NEW.status = 'delivered_paid') 
     AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
            UPDATE products
            SET 
              reserved_stock = reserved_stock - item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'sale', item.quantity, product.current_stock,
              product.current_stock, 'Vente finalisée - Commande livrée', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- When order is cancelled, restore stock (IDEMPOTENT)
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF OLD.status IN ('preparing', 'ready', 'to_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Annulation commande', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- When order is returned (IDEMPOTENT)
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    IF OLD.status IN ('preparing', 'ready', 'to_station', 'shipped') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Retour commande non livrée', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- BEGIN 20260210113034_a65ab296-2758-44a0-bf14-b8a10a91246a.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  product RECORD;
  last_movement_type TEXT;
BEGIN

  -- ============================================================
  -- STEP 0: REVERSE SALE when leaving delivered/delivered_paid
  -- If order was delivered and goes back to ANY other status,
  -- undo the sale (re-reserve stock) so downstream handlers work
  -- ============================================================
  IF OLD.status IN ('delivered', 'delivered_paid') AND NEW.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            -- Re-reserve the stock (undo the sale)
            UPDATE products
            SET 
              reserved_stock = reserved_stock + item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            -- Record re-reservation as 'exit' so idempotency checks work
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'exit', item.quantity, product.current_stock,
              product.current_stock,
              'Réservation restaurée - retour depuis livré', NEW.order_number, auth.uid()
            );
            
            -- Remove sale record so it can be re-finalized later
            DELETE FROM stock_movements 
            WHERE reference = NEW.order_number 
              AND product_id = item.product_id 
              AND movement_type = 'sale';
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 1: RESERVE stock when entering "preparing" (IDEMPOTENT)
  -- ============================================================
  IF NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status != 'preparing') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number 
          AND sm.product_id = item.product_id 
          AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC
        LIMIT 1;

        IF last_movement_type IS NULL OR last_movement_type = 'return' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock - item.quantity,
              reserved_stock = reserved_stock + item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'exit', item.quantity, product.current_stock,
              product.current_stock - item.quantity,
              'Réservation pour commande en préparation', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 2: RESTORE when going back to confirmed (IDEMPOTENT)
  -- Expanded to cover ALL possible previous statuses
  -- ============================================================
  IF NEW.status = 'confirmed' AND OLD.status IN (
    'preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 
    'shipped', 'Échec_de_livraison', 'exchange', 'erreur',
    'delivered', 'delivered_paid'
  ) THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number 
          AND sm.product_id = item.product_id 
          AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC
        LIMIT 1;

        IF last_movement_type = 'exit' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock + item.quantity,
              reserved_stock = GREATEST(0, reserved_stock - item.quantity),
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'return', item.quantity, product.current_stock,
              product.current_stock + item.quantity,
              'Retour au statut confirmé', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 3: FINALIZE SALE when delivered (IDEMPOTENT)
  -- ============================================================
  IF (NEW.status = 'delivered' OR NEW.status = 'delivered_paid') 
     AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
            UPDATE products
            SET 
              reserved_stock = reserved_stock - item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'sale', item.quantity, product.current_stock,
              product.current_stock, 'Vente finalisée - Commande livrée', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 4: RESTORE on CANCEL (IDEMPOTENT)
  -- Expanded to cover all reserved-phase statuses + delivered
  -- ============================================================
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF OLD.status IN (
      'preparing', 'ready', 'to_station', 'at_station', 'au_bureau',
      'shipped', 'Échec_de_livraison', 'exchange',
      'delivered', 'delivered_paid'
    ) THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Annulation commande', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- ============================================================
  -- STEP 5: RESTORE on RETURN (IDEMPOTENT)
  -- Expanded to cover all reserved-phase statuses + delivered
  -- ============================================================
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    IF OLD.status IN (
      'preparing', 'ready', 'to_station', 'at_station', 'au_bureau',
      'shipped', 'Échec_de_livraison', 'exchange',
      'delivered', 'delivered_paid'
    ) THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Retour commande non livrée', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- ============================================================
  -- STEP 6: RESTORE on ERREUR (IDEMPOTENT) - NEW
  -- ============================================================
  IF NEW.status = 'erreur' AND OLD.status != 'erreur' THEN
    IF OLD.status IN (
      'preparing', 'ready', 'to_station', 'at_station', 'au_bureau',
      'shipped', 'Échec_de_livraison', 'exchange',
      'delivered', 'delivered_paid'
    ) THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Erreur commande', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- BEGIN 20260210151756_3717cea3-60f3-48f4-bde8-ea3c1c77175f.sql
-- ============================================================

-- Update the trigger function to generate sequential order numbers like ORD-00001
CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  -- Get the max current sequential number
  SELECT COALESCE(MAX(
    CASE 
      WHEN order_number ~ '^ORD-[0-9]+$' 
      THEN CAST(SUBSTRING(order_number FROM 5) AS INTEGER)
      ELSE 0 
    END
  ), 0) + 1
  INTO next_num
  FROM orders;
  
  NEW.order_number = 'ORD-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$function$;

-- Update existing orders with sequential numbers
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM orders
)
UPDATE orders 
SET order_number = 'ORD-' || LPAD(numbered.rn::TEXT, 5, '0')
FROM numbered
WHERE orders.id = numbered.id;


-- ============================================================
-- BEGIN 20260210152744_ad42af1e-d77a-4d6a-8055-9ecc06b6b952.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  product RECORD;
  last_movement_type TEXT;
  reserve_statuses TEXT[] := ARRAY['preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'shipped', 'Échec_de_livraison', 'exchange'];
BEGIN

  -- ============================================================
  -- STEP 0: REVERSE SALE when leaving delivered/delivered_paid
  -- ============================================================
  IF OLD.status IN ('delivered', 'delivered_paid') AND NEW.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              reserved_stock = reserved_stock + item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'exit', item.quantity, product.current_stock,
              product.current_stock,
              'Réservation restaurée - retour depuis livré', NEW.order_number, auth.uid()
            );
            
            DELETE FROM stock_movements 
            WHERE reference = NEW.order_number 
              AND product_id = item.product_id 
              AND movement_type = 'sale';
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 1: RESERVE stock when entering any reserve status (IDEMPOTENT)
  -- Statuses: preparing, ready, to_station, at_station, au_bureau, shipped, Échec_de_livraison, exchange
  -- ============================================================
  IF NEW.status = ANY(reserve_statuses) AND (OLD.status IS NULL OR NOT (OLD.status = ANY(reserve_statuses))) THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number 
          AND sm.product_id = item.product_id 
          AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC
        LIMIT 1;

        IF last_movement_type IS NULL OR last_movement_type = 'return' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock - item.quantity,
              reserved_stock = reserved_stock + item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'exit', item.quantity, product.current_stock,
              product.current_stock - item.quantity,
              'Réservation pour commande', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 2: RESTORE when going back to confirmed (IDEMPOTENT)
  -- ============================================================
  IF NEW.status = 'confirmed' AND OLD.status IN (
    'preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 
    'shipped', 'Échec_de_livraison', 'exchange', 'erreur',
    'delivered', 'delivered_paid'
  ) THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number 
          AND sm.product_id = item.product_id 
          AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC
        LIMIT 1;

        IF last_movement_type = 'exit' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products
            SET 
              current_stock = current_stock + item.quantity,
              reserved_stock = GREATEST(0, reserved_stock - item.quantity),
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'return', item.quantity, product.current_stock,
              product.current_stock + item.quantity,
              'Retour au statut confirmé', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 3: FINALIZE SALE when delivered (IDEMPOTENT)
  -- ============================================================
  IF (NEW.status = 'delivered' OR NEW.status = 'delivered_paid') 
     AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
            UPDATE products
            SET 
              reserved_stock = reserved_stock - item.quantity,
              updated_at = now()
            WHERE id = item.product_id;
            
            INSERT INTO stock_movements (
              product_id, movement_type, quantity, previous_stock, new_stock, 
              reason, reference, created_by
            ) VALUES (
              item.product_id, 'sale', item.quantity, product.current_stock,
              product.current_stock, 'Vente finalisée - Commande livrée', NEW.order_number, auth.uid()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 4: RESTORE on CANCEL (IDEMPOTENT)
  -- ============================================================
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF OLD.status = ANY(reserve_statuses) OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Annulation commande', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- ============================================================
  -- STEP 5: RESTORE on RETURN (IDEMPOTENT)
  -- ============================================================
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    IF OLD.status = ANY(reserve_statuses) OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Retour commande non livrée', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- ============================================================
  -- STEP 6: RESTORE on ERREUR (IDEMPOTENT)
  -- ============================================================
  IF NEW.status = 'erreur' AND OLD.status != 'erreur' THEN
    IF OLD.status = ANY(reserve_statuses) OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number 
            AND sm.product_id = item.product_id 
            AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC
          LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products
              SET 
                current_stock = current_stock + item.quantity,
                reserved_stock = GREATEST(0, reserved_stock - item.quantity),
                updated_at = now()
              WHERE id = item.product_id;
              
              INSERT INTO stock_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, 
                reason, reference, created_by
              ) VALUES (
                item.product_id, 'return', item.quantity, product.current_stock,
                product.current_stock + item.quantity, 'Erreur commande', NEW.order_number, auth.uid()
              );
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260210153037_89d423d6-7663-44dd-aef0-8e02eeea86f2.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  product RECORD;
  last_movement_type TEXT;
  is_new_reserve BOOLEAN;
  was_old_reserve BOOLEAN;
BEGIN
  -- Determine if new/old status is a reserve status
  is_new_reserve := NEW.status IN ('preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'shipped', 'Échec_de_livraison', 'exchange');
  was_old_reserve := OLD.status IN ('preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'shipped', 'Échec_de_livraison', 'exchange');

  -- ============================================================
  -- STEP 0: REVERSE SALE when leaving delivered/delivered_paid
  -- ============================================================
  IF OLD.status IN ('delivered', 'delivered_paid') AND NEW.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products SET reserved_stock = reserved_stock + item.quantity, updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'exit', item.quantity, product.current_stock, product.current_stock, 'Réservation restaurée - retour depuis livré', NEW.order_number, auth.uid());
            DELETE FROM stock_movements WHERE reference = NEW.order_number AND product_id = item.product_id AND movement_type = 'sale';
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 1: RESERVE stock when entering any reserve status (IDEMPOTENT)
  -- ============================================================
  IF is_new_reserve AND NOT was_old_reserve THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC LIMIT 1;

        IF last_movement_type IS NULL OR last_movement_type = 'return' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products SET current_stock = current_stock - item.quantity, reserved_stock = reserved_stock + item.quantity, updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'exit', item.quantity, product.current_stock, product.current_stock - item.quantity, 'Réservation pour commande', NEW.order_number, auth.uid());
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 2: RESTORE when going back to confirmed
  -- ============================================================
  IF NEW.status = 'confirmed' AND (was_old_reserve OR OLD.status IN ('erreur', 'delivered', 'delivered_paid')) THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC LIMIT 1;

        IF last_movement_type = 'exit' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Retour au statut confirmé', NEW.order_number, auth.uid());
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 3: FINALIZE SALE when delivered
  -- ============================================================
  IF NEW.status IN ('delivered', 'delivered_paid') AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM stock_movements WHERE reference = NEW.order_number AND product_id = item.product_id AND movement_type = 'sale') THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
            UPDATE products SET reserved_stock = reserved_stock - item.quantity, updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'sale', item.quantity, product.current_stock, product.current_stock, 'Vente finalisée - Commande livrée', NEW.order_number, auth.uid());
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- STEP 4: RESTORE on CANCEL
  -- ============================================================
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF was_old_reserve OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
              INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
              VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Annulation commande', NEW.order_number, auth.uid());
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- ============================================================
  -- STEP 5: RESTORE on RETURN
  -- ============================================================
  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    IF was_old_reserve OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
              INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
              VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Retour commande non livrée', NEW.order_number, auth.uid());
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- ============================================================
  -- STEP 6: RESTORE on ERREUR
  -- ============================================================
  IF NEW.status = 'erreur' AND OLD.status != 'erreur' THEN
    IF was_old_reserve OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
              INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
              VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Erreur commande', NEW.order_number, auth.uid());
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260210164353_9ecdde95-772e-4aca-8f91-3ad78b2f63c7.sql
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- ============================================================
-- BEGIN 20260210170925_5831015c-efa1-4180-b410-617d3eb18f8a.sql
-- ============================================================
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'en_livraison';

-- ============================================================
-- BEGIN 20260210171206_7d768be9-a8d9-4ac3-99bf-845910538ee0.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  product RECORD;
  last_movement_type TEXT;
  is_new_reserve BOOLEAN;
  was_old_reserve BOOLEAN;
BEGIN
  is_new_reserve := NEW.status IN ('preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'shipped', 'Échec_de_livraison', 'exchange');
  was_old_reserve := OLD.status IN ('preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'shipped', 'Échec_de_livraison', 'exchange');

  IF OLD.status IN ('delivered', 'delivered_paid') AND NEW.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products SET reserved_stock = reserved_stock + item.quantity, updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'exit', item.quantity, product.current_stock, product.current_stock, 'Réservation restaurée - retour depuis livré', NEW.order_number, auth.uid());
            DELETE FROM stock_movements WHERE reference = NEW.order_number AND product_id = item.product_id AND movement_type = 'sale';
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF is_new_reserve AND NOT was_old_reserve THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC LIMIT 1;

        IF last_movement_type IS NULL OR last_movement_type = 'return' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products SET current_stock = current_stock - item.quantity, reserved_stock = reserved_stock + item.quantity, updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'exit', item.quantity, product.current_stock, product.current_stock - item.quantity, 'Réservation pour commande', NEW.order_number, auth.uid());
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF NEW.status = 'confirmed' AND (was_old_reserve OR OLD.status IN ('erreur', 'delivered', 'delivered_paid')) THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC LIMIT 1;

        IF last_movement_type = 'exit' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Retour au statut confirmé', NEW.order_number, auth.uid());
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF NEW.status IN ('delivered', 'delivered_paid') AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM stock_movements WHERE reference = NEW.order_number AND product_id = item.product_id AND movement_type = 'sale') THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
            UPDATE products SET reserved_stock = reserved_stock - item.quantity, updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'sale', item.quantity, product.current_stock, product.current_stock, 'Vente finalisée - Commande livrée', NEW.order_number, auth.uid());
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF was_old_reserve OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
              INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
              VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Annulation commande', NEW.order_number, auth.uid());
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    IF was_old_reserve OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
              INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
              VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Retour commande non livrée', NEW.order_number, auth.uid());
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  IF NEW.status = 'erreur' AND OLD.status != 'erreur' THEN
    IF was_old_reserve OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
              INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
              VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Erreur commande', NEW.order_number, auth.uid());
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- BEGIN 20260213165352_7ed9abd5-db00-45ab-adf4-f5a6dc1a8e41.sql
-- ============================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS alert TEXT DEFAULT NULL;

-- ============================================================
-- BEGIN 20260214000337_987306da-b47a-41bd-bb46-a33777655ec1.sql
-- ============================================================

-- Add 'alerte' to the order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'alerte';

-- Update the stock sync trigger to include 'alerte' in reservation statuses
CREATE OR REPLACE FUNCTION public.handle_order_stock_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  product RECORD;
  last_movement_type TEXT;
  is_new_reserve BOOLEAN;
  was_old_reserve BOOLEAN;
BEGIN
  is_new_reserve := NEW.status IN ('preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'shipped', 'Échec_de_livraison', 'exchange', 'alerte');
  was_old_reserve := OLD.status IN ('preparing', 'ready', 'to_station', 'at_station', 'au_bureau', 'en_livraison', 'shipped', 'Échec_de_livraison', 'exchange', 'alerte');

  IF OLD.status IN ('delivered', 'delivered_paid') AND NEW.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM stock_movements 
          WHERE reference = NEW.order_number 
            AND product_id = item.product_id 
            AND movement_type = 'sale'
        ) THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products SET reserved_stock = reserved_stock + item.quantity, updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'exit', item.quantity, product.current_stock, product.current_stock, 'Réservation restaurée - retour depuis livré', NEW.order_number, auth.uid());
            DELETE FROM stock_movements WHERE reference = NEW.order_number AND product_id = item.product_id AND movement_type = 'sale';
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF is_new_reserve AND NOT was_old_reserve THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC LIMIT 1;

        IF last_movement_type IS NULL OR last_movement_type = 'return' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products SET current_stock = current_stock - item.quantity, reserved_stock = reserved_stock + item.quantity, updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'exit', item.quantity, product.current_stock, product.current_stock - item.quantity, 'Réservation pour commande', NEW.order_number, auth.uid());
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF NEW.status = 'confirmed' AND (was_old_reserve OR OLD.status IN ('erreur', 'delivered', 'delivered_paid')) THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        SELECT sm.movement_type INTO last_movement_type
        FROM stock_movements sm
        WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
        ORDER BY sm.created_at DESC LIMIT 1;

        IF last_movement_type = 'exit' THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL THEN
            UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Retour au statut confirmé', NEW.order_number, auth.uid());
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF NEW.status IN ('delivered', 'delivered_paid') AND OLD.status NOT IN ('delivered', 'delivered_paid') THEN
    FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM stock_movements WHERE reference = NEW.order_number AND product_id = item.product_id AND movement_type = 'sale') THEN
          SELECT * INTO product FROM products WHERE id = item.product_id;
          IF product.id IS NOT NULL AND product.reserved_stock >= item.quantity THEN
            UPDATE products SET reserved_stock = reserved_stock - item.quantity, updated_at = now() WHERE id = item.product_id;
            INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
            VALUES (item.product_id, 'sale', item.quantity, product.current_stock, product.current_stock, 'Vente finalisée - Commande livrée', NEW.order_number, auth.uid());
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF was_old_reserve OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
              INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
              VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Annulation commande', NEW.order_number, auth.uid());
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
    IF was_old_reserve OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
              INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
              VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Retour commande non livrée', NEW.order_number, auth.uid());
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  IF NEW.status = 'erreur' AND OLD.status != 'erreur' THEN
    IF was_old_reserve OR OLD.status IN ('delivered', 'delivered_paid') THEN
      FOR item IN SELECT * FROM order_items WHERE order_id = NEW.id
      LOOP
        IF item.product_id IS NOT NULL THEN
          SELECT sm.movement_type INTO last_movement_type
          FROM stock_movements sm
          WHERE sm.reference = NEW.order_number AND sm.product_id = item.product_id AND sm.movement_type IN ('exit', 'return')
          ORDER BY sm.created_at DESC LIMIT 1;

          IF last_movement_type = 'exit' THEN
            SELECT * INTO product FROM products WHERE id = item.product_id;
            IF product.id IS NOT NULL THEN
              UPDATE products SET current_stock = current_stock + item.quantity, reserved_stock = GREATEST(0, reserved_stock - item.quantity), updated_at = now() WHERE id = item.product_id;
              INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reason, reference, created_by)
              VALUES (item.product_id, 'return', item.quantity, product.current_stock, product.current_stock + item.quantity, 'Erreur commande', NEW.order_number, auth.uid());
            END IF;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260214231408_b952d025-43a3-49b5-9cf6-b6a02c8970d3.sql
-- ============================================================

-- Table for auto-confirmation logs
CREATE TABLE public.auto_confirmation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  ai_decision TEXT NOT NULL CHECK (ai_decision IN ('auto_confirm', 'ask_customer', 'reject')),
  ai_reason TEXT,
  checks_result JSONB DEFAULT '{}'::jsonb,
  whatsapp_message_sent BOOLEAN DEFAULT false,
  whatsapp_response TEXT,
  customer_reply TEXT,
  final_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_confirmation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view auto confirmation logs"
  ON public.auto_confirmation_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert auto confirmation logs"
  ON public.auto_confirmation_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage auto confirmation logs"
  ON public.auto_confirmation_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow edge function (service role) to insert
CREATE POLICY "Allow insert from service role"
  ON public.auto_confirmation_logs FOR INSERT
  WITH CHECK (true);

CREATE TRIGGER update_auto_confirmation_logs_updated_at
  BEFORE UPDATE ON public.auto_confirmation_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- BEGIN 20260214231447_9ce9dfe1-c1a7-421e-9832-21195e3dc77a.sql
-- ============================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Service role can manage auto confirmation logs" ON public.auto_confirmation_logs;
DROP POLICY IF EXISTS "Allow insert from service role" ON public.auto_confirmation_logs;

-- Add proper update policy for admins
CREATE POLICY "Admins can update auto confirmation logs"
  ON public.auto_confirmation_logs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));


-- ============================================================
-- BEGIN 20260214232140_f6707ed2-2e96-4a86-abef-06f6d7a7c985.sql
-- ============================================================

-- Add conversation tracking columns to auto_confirmation_logs
ALTER TABLE public.auto_confirmation_logs 
  ADD COLUMN IF NOT EXISTS conversation_status TEXT DEFAULT 'pending' CHECK (conversation_status IN ('pending', 'awaiting_reply', 'confirmed', 'cancelled', 'expired')),
  ADD COLUMN IF NOT EXISTS conversation_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE;


-- ============================================================
-- BEGIN 20260216001604_c3490e5e-295c-4d68-8099-4da6d2a430d4.sql
-- ============================================================

-- Table to store automation settings (prompts, toggles, etc.)
CREATE TABLE public.automation_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage
CREATE POLICY "Admins can view automation settings"
ON public.automation_settings FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert automation settings"
ON public.automation_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update automation settings"
ON public.automation_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete automation settings"
ON public.automation_settings FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_automation_settings_updated_at
BEFORE UPDATE ON public.automation_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- BEGIN 20260216031956_aaa64434-74e7-4c3b-b95e-b4a3eca9efc6.sql
-- ============================================================
ALTER TABLE public.auto_confirmation_logs DROP CONSTRAINT auto_confirmation_logs_conversation_status_check;
ALTER TABLE public.auto_confirmation_logs ADD CONSTRAINT auto_confirmation_logs_conversation_status_check CHECK (conversation_status = ANY (ARRAY['pending'::text, 'awaiting_reply'::text, 'confirmed'::text, 'cancelled'::text, 'expired'::text, 'manual_takeover'::text]));

-- ============================================================
-- BEGIN 20260216165358_9f415977-5b14-4d52-8320-dd48412aef94.sql
-- ============================================================

-- Store Meta/Facebook integration credentials
CREATE TABLE public.meta_integration (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id text,
  app_id text,
  app_secret_encrypted text,
  page_access_token_encrypted text,
  verify_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_connected boolean NOT NULL DEFAULT false,
  instagram_connected boolean NOT NULL DEFAULT false,
  facebook_connected boolean NOT NULL DEFAULT false,
  auto_reply_comments boolean NOT NULL DEFAULT true,
  auto_reply_messages boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_integration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view meta integration" ON public.meta_integration
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert meta integration" ON public.meta_integration
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update meta integration" ON public.meta_integration
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete meta integration" ON public.meta_integration
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_meta_integration_updated_at
  BEFORE UPDATE ON public.meta_integration
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- BEGIN 20260216165814_0af15b72-0f71-4c13-9bd2-9ecc09ae1f8b.sql
-- ============================================================

-- Create table for multiple Meta pages/accounts
CREATE TABLE public.meta_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id uuid REFERENCES public.meta_integration(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  page_name text NOT NULL,
  page_id text NOT NULL,
  page_access_token text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view meta pages" ON public.meta_pages
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert meta pages" ON public.meta_pages
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update meta pages" ON public.meta_pages
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete meta pages" ON public.meta_pages
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_meta_pages_updated_at
  BEFORE UPDATE ON public.meta_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- BEGIN 20260217002249_f0cc6db6-9165-4600-a0cb-437c91e86844.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_history (order_id, old_status, new_status, changed_by, changed_by_user_id)
    VALUES (
      NEW.id, 
      OLD.status, 
      NEW.status, 
      COALESCE(NEW.assigned_agent, CASE WHEN auth.uid() IS NULL THEN 'IA' ELSE NULL END),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260218015618_ceb4274b-3469-4d86-9f51-4015d5fc6531.sql
-- ============================================================

-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Create trigger function to auto-call confirmation edge function
CREATE OR REPLACE FUNCTION public.trigger_auto_confirm_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _confirmation_enabled boolean;
  _base_url text;
  _anon_key text;
BEGIN
  -- Check if auto-confirmation is enabled
  SELECT (setting_value->>'enabled')::boolean INTO _confirmation_enabled
  FROM public.automation_settings
  WHERE setting_key = 'confirmation';

  -- Only proceed if enabled (default to false if not found)
  IF COALESCE(_confirmation_enabled, false) = false THEN
    RETURN NEW;
  END IF;

  -- Only trigger for orders with status 'new'
  IF NEW.status != 'new' THEN
    RETURN NEW;
  END IF;

  -- Get Supabase URL from config
  _base_url := 'https://csllsbgiorpvzqrtijfv.supabase.co';
  _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbGxzYmdpb3JwdnpxcnRpamZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExOTAzNjYsImV4cCI6MjA4Njc2NjM2Nn0.6hsm-x_AOX12lUkUxTYTwLu6JycAHM72AXrIT7OpvdQ';

  -- Call the edge function asynchronously via pg_net
  PERFORM extensions.http_post(
    url := _base_url || '/functions/v1/auto-confirm-orders',
    body := jsonb_build_object('orderIds', jsonb_build_array(NEW.id), 'mode', 'manual'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS on_new_order_auto_confirm ON public.orders;
CREATE TRIGGER on_new_order_auto_confirm
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_confirm_order();


-- ============================================================
-- BEGIN 20260218022335_415bab2c-9b0b-40f9-acd5-cafc3fde71fd.sql
-- ============================================================

-- Fix the trigger function to use the correct pg_net function signature
CREATE OR REPLACE FUNCTION public.trigger_auto_confirm_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _confirmation_enabled boolean;
  _base_url text;
  _anon_key text;
BEGIN
  -- Check if auto-confirmation is enabled
  SELECT (setting_value->>'enabled')::boolean INTO _confirmation_enabled
  FROM public.automation_settings
  WHERE setting_key = 'confirmation';

  -- Only proceed if enabled (default to false if not found)
  IF COALESCE(_confirmation_enabled, false) = false THEN
    RETURN NEW;
  END IF;

  -- Only trigger for orders with status 'new'
  IF NEW.status != 'new' THEN
    RETURN NEW;
  END IF;

  _base_url := 'https://csllsbgiorpvzqrtijfv.supabase.co';
  _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbGxzYmdpb3JwdnpxcnRpamZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExOTAzNjYsImV4cCI6MjA4Njc2NjM2Nn0.6hsm-x_AOX12lUkUxTYTwLu6JycAHM72AXrIT7OpvdQ';

  -- Use net.http_post (correct pg_net function)
  PERFORM net.http_post(
    url := _base_url || '/functions/v1/auto-confirm-orders',
    body := jsonb_build_object('orderIds', jsonb_build_array(NEW.id), 'mode', 'manual'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$$;


-- ============================================================
-- BEGIN 20260218041655_55b0555c-e452-45e1-9307-59e95e1b7c84.sql
-- ============================================================
-- Drop the existing broad SELECT policy for orders
DROP POLICY IF EXISTS "App users can view orders" ON public.orders;

-- Admins can view ALL orders
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Confirmateurs can only see orders assigned to them
CREATE POLICY "Confirmateurs can view assigned orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'confirmateur'::app_role) 
  AND assigned_agent = (
    SELECT COALESCE(full_name, email) 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Stock managers can view all orders (read-only for stock tracking)
CREATE POLICY "Stock managers can view orders"
ON public.orders
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'stock_manager'::app_role));

-- ============================================================
-- BEGIN 20260218043057_69bd4d34-83e7-4a90-a6f6-f0fe6a0e7e07.sql
-- ============================================================
-- Table for auto-assignment rules
CREATE TABLE public.assignment_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('source', 'product')),
  agent_name TEXT NOT NULL,
  match_value TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for assignment settings (round-robin counter, workload mode, etc.)
CREATE TABLE public.assignment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Initialize default settings
INSERT INTO public.assignment_settings (setting_key, setting_value)
VALUES 
  ('mode', '"round_robin"'::jsonb),
  ('round_robin_index', '0'::jsonb);

-- Enable RLS
ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assignment_rules
CREATE POLICY "Admins can manage assignment rules"
ON public.assignment_rules FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Confirmateurs can view assignment rules"
ON public.assignment_rules FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'confirmateur'::app_role));

-- RLS Policies for assignment_settings
CREATE POLICY "Admins can manage assignment settings"
ON public.assignment_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Confirmateurs can view assignment settings"
ON public.assignment_settings FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'confirmateur'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_assignment_rules_updated_at
BEFORE UPDATE ON public.assignment_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignment_settings_updated_at
BEFORE UPDATE ON public.assignment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- BEGIN 20260218050926_a0c66e97-5303-4820-8f53-6557188b0336.sql
-- ============================================================

-- Add auto_enabled setting
INSERT INTO assignment_settings (setting_key, setting_value)
VALUES ('auto_enabled', 'false')
ON CONFLICT DO NOTHING;

-- Create the auto-assign function
CREATE OR REPLACE FUNCTION public.auto_assign_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _auto_enabled boolean;
  _mode text;
  _agents text[];
  _agent_name text;
  _rule RECORD;
  _min_count int;
  _min_agent text;
  _rr_index int;
  _count int;
  _a text;
BEGIN
  -- Check if auto-assignment is enabled
  SELECT (setting_value)::boolean INTO _auto_enabled
  FROM assignment_settings WHERE setting_key = 'auto_enabled';
  
  IF NOT COALESCE(_auto_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Only auto-assign if no agent is set
  IF NEW.assigned_agent IS NOT NULL AND NEW.assigned_agent != '' THEN
    RETURN NEW;
  END IF;

  -- Get confirmateur names
  SELECT array_agg(COALESCE(p.full_name, p.email))
  INTO _agents
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'confirmateur' AND p.is_approved = true;

  IF _agents IS NULL OR array_length(_agents, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Get current mode
  SELECT trim(both '"' from setting_value::text) INTO _mode
  FROM assignment_settings WHERE setting_key = 'mode';
  _mode := COALESCE(_mode, 'round_robin');

  _agent_name := NULL;

  -- Try rules (for rules or combined mode)
  IF _mode IN ('rules', 'combined') THEN
    -- Check source rules
    SELECT agent_name INTO _agent_name
    FROM assignment_rules
    WHERE rule_type = 'source' AND match_value = NEW.source::text AND is_active = true
    LIMIT 1;

    -- If rules mode and no match, skip
    IF _mode = 'rules' AND _agent_name IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Fallback: workload or round-robin
  IF _agent_name IS NULL THEN
    IF _mode IN ('workload', 'combined') THEN
      -- Find agent with fewest active orders
      _min_count := 999999;
      _min_agent := NULL;
      FOREACH _a IN ARRAY _agents LOOP
        SELECT count(*) INTO _count FROM orders
        WHERE assigned_agent = _a 
        AND status NOT IN ('delivered', 'delivered_paid', 'cancelled', 'returned');
        IF _count < _min_count THEN
          _min_count := _count;
          _min_agent := _a;
        END IF;
      END LOOP;
      _agent_name := _min_agent;
    ELSE
      -- Round-robin
      SELECT count(*) INTO _rr_index FROM orders;
      _agent_name := _agents[(_rr_index % array_length(_agents, 1)) + 1];
    END IF;
  END IF;

  NEW.assigned_agent := _agent_name;
  RETURN NEW;
END;
$function$;

-- Create trigger
DROP TRIGGER IF EXISTS auto_assign_order_trigger ON orders;
CREATE TRIGGER auto_assign_order_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_order();


-- ============================================================
-- BEGIN 20260218052226_e4efda4c-dbc4-4efb-b2b2-a3e4937ba2e8.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_assign_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _auto_enabled_raw text;
  _auto_enabled boolean;
  _mode text;
  _agents text[];
  _agent_name text;
  _min_count int;
  _min_agent text;
  _rr_index int;
  _count int;
  _a text;
BEGIN
  -- Check if auto-assignment is enabled (handle jsonb string "true" or boolean true)
  SELECT trim(both '"' from setting_value::text) INTO _auto_enabled_raw
  FROM assignment_settings WHERE setting_key = 'auto_enabled';
  
  _auto_enabled := COALESCE(_auto_enabled_raw::boolean, false);
  
  IF NOT _auto_enabled THEN
    RETURN NEW;
  END IF;

  -- Only auto-assign if no agent is set
  IF NEW.assigned_agent IS NOT NULL AND NEW.assigned_agent != '' THEN
    RETURN NEW;
  END IF;

  -- Get confirmateur names
  SELECT array_agg(COALESCE(p.full_name, p.email))
  INTO _agents
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'confirmateur' AND p.is_approved = true;

  IF _agents IS NULL OR array_length(_agents, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Get current mode
  SELECT trim(both '"' from setting_value::text) INTO _mode
  FROM assignment_settings WHERE setting_key = 'mode';
  _mode := COALESCE(_mode, 'round_robin');

  _agent_name := NULL;

  -- Try source rules (for rules or combined mode)
  IF _mode IN ('rules', 'combined') THEN
    SELECT agent_name INTO _agent_name
    FROM assignment_rules
    WHERE rule_type = 'source' AND match_value = NEW.source::text AND is_active = true
    LIMIT 1;

    -- In pure rules mode with no match, fall through to workload as fallback
  END IF;

  -- Fallback: workload or round-robin (always try if no rule matched)
  IF _agent_name IS NULL THEN
    IF _mode IN ('workload', 'combined') THEN
      _min_count := 999999;
      _min_agent := NULL;
      FOREACH _a IN ARRAY _agents LOOP
        SELECT count(*) INTO _count FROM orders
        WHERE assigned_agent = _a 
        AND status NOT IN ('delivered', 'delivered_paid', 'cancelled', 'returned');
        IF _count < _min_count THEN
          _min_count := _count;
          _min_agent := _a;
        END IF;
      END LOOP;
      _agent_name := _min_agent;
    ELSE
      -- Round-robin (also used as fallback for rules mode)
      SELECT count(*) INTO _rr_index FROM orders;
      _agent_name := _agents[(_rr_index % array_length(_agents, 1)) + 1];
    END IF;
  END IF;

  NEW.assigned_agent := _agent_name;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_assign_order error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260218053508_1fdb3478-e0ac-45e2-a306-50d650b6de17.sql
-- ============================================================

-- Add date columns to assignment_rules for date_period rule type
ALTER TABLE public.assignment_rules
ADD COLUMN start_date timestamp with time zone,
ADD COLUMN end_date timestamp with time zone;

-- Update the auto_assign_order function to support date_period rules
CREATE OR REPLACE FUNCTION public.auto_assign_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _auto_enabled_raw text;
  _auto_enabled boolean;
  _mode text;
  _agents text[];
  _agent_name text;
  _min_count int;
  _min_agent text;
  _rr_index int;
  _count int;
  _a text;
BEGIN
  SELECT trim(both '"' from setting_value::text) INTO _auto_enabled_raw
  FROM assignment_settings WHERE setting_key = 'auto_enabled';
  
  _auto_enabled := COALESCE(_auto_enabled_raw::boolean, false);
  
  IF NOT _auto_enabled THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_agent IS NOT NULL AND NEW.assigned_agent != '' THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(COALESCE(p.full_name, p.email))
  INTO _agents
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'confirmateur' AND p.is_approved = true;

  IF _agents IS NULL OR array_length(_agents, 1) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT trim(both '"' from setting_value::text) INTO _mode
  FROM assignment_settings WHERE setting_key = 'mode';
  _mode := COALESCE(_mode, 'round_robin');

  _agent_name := NULL;

  -- Try rules (source, product, date_period) for rules or combined mode
  IF _mode IN ('rules', 'combined') THEN
    -- Try source rules first
    SELECT agent_name INTO _agent_name
    FROM assignment_rules
    WHERE rule_type = 'source' AND match_value = NEW.source::text AND is_active = true
    LIMIT 1;

    -- Try date_period rules if no source match
    IF _agent_name IS NULL THEN
      SELECT agent_name INTO _agent_name
      FROM assignment_rules
      WHERE rule_type = 'date_period' 
        AND is_active = true
        AND start_date <= now()
        AND end_date >= now()
      ORDER BY priority ASC
      LIMIT 1;
    END IF;
  END IF;

  -- Fallback: workload or round-robin
  IF _agent_name IS NULL THEN
    IF _mode IN ('workload', 'combined') THEN
      _min_count := 999999;
      _min_agent := NULL;
      FOREACH _a IN ARRAY _agents LOOP
        SELECT count(*) INTO _count FROM orders
        WHERE assigned_agent = _a 
        AND status NOT IN ('delivered', 'delivered_paid', 'cancelled', 'returned');
        IF _count < _min_count THEN
          _min_count := _count;
          _min_agent := _a;
        END IF;
      END LOOP;
      _agent_name := _min_agent;
    ELSE
      SELECT count(*) INTO _rr_index FROM orders;
      _agent_name := _agents[(_rr_index % array_length(_agents, 1)) + 1];
    END IF;
  END IF;

  NEW.assigned_agent := _agent_name;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_assign_order error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260218053947_71787b55-0d2e-46af-8669-3e84268801e6.sql
-- ============================================================

-- Add schedule columns to assignment_rules
ALTER TABLE public.assignment_rules
ADD COLUMN days_of_week integer[] DEFAULT '{}',
ADD COLUMN start_hour integer DEFAULT 0,
ADD COLUMN end_hour integer DEFAULT 23;

-- Update auto_assign_order to support schedule rules
CREATE OR REPLACE FUNCTION public.auto_assign_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _auto_enabled_raw text;
  _auto_enabled boolean;
  _mode text;
  _agents text[];
  _agent_name text;
  _min_count int;
  _min_agent text;
  _rr_index int;
  _count int;
  _a text;
  _current_dow int;
  _current_hour int;
BEGIN
  SELECT trim(both '"' from setting_value::text) INTO _auto_enabled_raw
  FROM assignment_settings WHERE setting_key = 'auto_enabled';
  _auto_enabled := COALESCE(_auto_enabled_raw::boolean, false);
  IF NOT _auto_enabled THEN RETURN NEW; END IF;

  IF NEW.assigned_agent IS NOT NULL AND NEW.assigned_agent != '' THEN RETURN NEW; END IF;

  SELECT array_agg(COALESCE(p.full_name, p.email))
  INTO _agents
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'confirmateur' AND p.is_approved = true;

  IF _agents IS NULL OR array_length(_agents, 1) = 0 THEN RETURN NEW; END IF;

  SELECT trim(both '"' from setting_value::text) INTO _mode
  FROM assignment_settings WHERE setting_key = 'mode';
  _mode := COALESCE(_mode, 'round_robin');

  _agent_name := NULL;

  IF _mode IN ('rules', 'combined') THEN
    -- Try source rules
    SELECT agent_name INTO _agent_name
    FROM assignment_rules
    WHERE rule_type = 'source' AND match_value = NEW.source::text AND is_active = true
    LIMIT 1;

    -- Try product rules
    IF _agent_name IS NULL THEN
      SELECT agent_name INTO _agent_name
      FROM assignment_rules ar
      WHERE ar.rule_type = 'product' AND ar.is_active = true
        AND EXISTS (
          SELECT 1 FROM order_items oi 
          WHERE oi.order_id = NEW.id AND oi.product_name = ar.match_value
        )
      LIMIT 1;
    END IF;

    -- Try schedule rules (day of week + hour)
    IF _agent_name IS NULL THEN
      _current_dow := EXTRACT(DOW FROM now()); -- 0=Sunday, 1=Monday...6=Saturday
      _current_hour := EXTRACT(HOUR FROM now());
      
      SELECT agent_name INTO _agent_name
      FROM assignment_rules
      WHERE rule_type = 'schedule'
        AND is_active = true
        AND _current_dow = ANY(days_of_week)
        AND _current_hour >= start_hour
        AND _current_hour < end_hour
      ORDER BY priority ASC
      LIMIT 1;
    END IF;
  END IF;

  -- Fallback
  IF _agent_name IS NULL THEN
    IF _mode IN ('workload', 'combined') THEN
      _min_count := 999999;
      FOREACH _a IN ARRAY _agents LOOP
        SELECT count(*) INTO _count FROM orders
        WHERE assigned_agent = _a 
        AND status NOT IN ('delivered', 'delivered_paid', 'cancelled', 'returned');
        IF _count < _min_count THEN
          _min_count := _count;
          _min_agent := _a;
        END IF;
      END LOOP;
      _agent_name := _min_agent;
    ELSE
      SELECT count(*) INTO _rr_index FROM orders;
      _agent_name := _agents[(_rr_index % array_length(_agents, 1)) + 1];
    END IF;
  END IF;

  NEW.assigned_agent := _agent_name;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_assign_order error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260218201242_6b49c0a7-f75f-44e4-8f00-4c417edd5684.sql
-- ============================================================
ALTER TABLE public.auto_confirmation_logs DROP CONSTRAINT auto_confirmation_logs_ai_decision_check;
ALTER TABLE public.auto_confirmation_logs ADD CONSTRAINT auto_confirmation_logs_ai_decision_check CHECK (ai_decision = ANY (ARRAY['auto_confirm'::text, 'ask_customer'::text, 'reject'::text, 'manual'::text]));

-- ============================================================
-- BEGIN 20260218204414_a593d656-b41c-488e-bd92-e0ff5ba7baab.sql
-- ============================================================

-- Create storage bucket for chat media files
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'chat-media' AND auth.uid() IS NOT NULL);

-- Allow public access to read files (needed for WASender to fetch the URL)
CREATE POLICY "Public can view chat media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-media');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete chat media"
ON storage.objects
FOR DELETE
USING (bucket_id = 'chat-media' AND auth.uid() IS NOT NULL);


-- ============================================================
-- BEGIN 20260220003328_60551a2e-e319-4bd1-9707-cfb0416bf28e.sql
-- ============================================================

-- Create deliveries table
CREATE TABLE public.deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id),
  tracking_number text UNIQUE,
  carrier text DEFAULT 'zr_express',
  delivery_status text DEFAULT 'preparing',
  last_update timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create alerts table
CREATE TABLE public.alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id),
  type text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for deliveries
CREATE POLICY "App users can view deliveries" ON public.deliveries FOR SELECT USING (is_app_user(auth.uid()));
CREATE POLICY "App users can insert deliveries" ON public.deliveries FOR INSERT WITH CHECK (is_app_user(auth.uid()));
CREATE POLICY "App users can update deliveries" ON public.deliveries FOR UPDATE USING (is_app_user(auth.uid()));
CREATE POLICY "Admins can delete deliveries" ON public.deliveries FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS policies for alerts
CREATE POLICY "App users can view alerts" ON public.alerts FOR SELECT USING (is_app_user(auth.uid()));
CREATE POLICY "App users can insert alerts" ON public.alerts FOR INSERT WITH CHECK (is_app_user(auth.uid()));
CREATE POLICY "App users can update alerts" ON public.alerts FOR UPDATE USING (is_app_user(auth.uid()));
CREATE POLICY "Admins can delete alerts" ON public.alerts FOR DELETE USING (has_role(auth.uid(), 'admin'));


-- ============================================================
-- BEGIN 20260220004154_f4b468a4-19ef-4238-8817-176d087ad3a2.sql
-- ============================================================
-- Create trigger function to call zr-express-create-order edge function
CREATE OR REPLACE FUNCTION public.trigger_zr_express_create_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _payload jsonb;
BEGIN
  -- Only trigger when status changes to 'preparing'
  IF NEW.status != 'preparing' THEN
    RETURN NEW;
  END IF;

  -- Skip if old status was already 'preparing' (avoid re-triggering on other updates)
  IF TG_OP = 'UPDATE' AND OLD.status = 'preparing' THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://ggrnsnbxdslhlvanymgo.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncm5zbmJ4ZHNsaGx2YW55bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDI0ODEsImV4cCI6MjA4NzAxODQ4MX0.lhG7bhcR5ok7ZnlBxOrJNDNtYg9NydXggFTl6ldUFKk';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/zr-express-create-order',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;

-- Create trigger on orders table for INSERT and UPDATE
CREATE TRIGGER on_order_preparing_zr_express
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_zr_express_create_order();


-- ============================================================
-- BEGIN 20260220015222_ac74a423-aaf3-4667-b52a-8d6866d4141d.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_auto_confirm_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _confirmation_enabled boolean;
  _base_url text;
  _anon_key text;
BEGIN
  SELECT (setting_value->>'enabled')::boolean INTO _confirmation_enabled
  FROM public.automation_settings
  WHERE setting_key = 'confirmation';

  IF COALESCE(_confirmation_enabled, false) = false THEN
    RETURN NEW;
  END IF;

  IF NEW.status != 'new' THEN
    RETURN NEW;
  END IF;

  _base_url := 'https://ggrnsnbxdslhlvanymgo.supabase.co';
  _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncm5zbmJ4ZHNsaGx2YW55bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDI0ODEsImV4cCI6MjA4NzAxODQ4MX0.lhG7bhcR5ok7ZnlBxOrJNDNtYg9NydXggFTl6ldUFKk';

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/auto-confirm-orders',
    body := jsonb_build_object('orderIds', jsonb_build_array(NEW.id), 'mode', 'manual'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260221010046_b08d5de6-df61-4fd1-a48a-3013084a35c9.sql
-- ============================================================

DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "App users can view profiles"
ON public.profiles
FOR SELECT
USING (is_app_user(auth.uid()));


-- ============================================================
-- BEGIN 20260221031302_526d25f8-0772-48e3-9aa0-8937212d3abd.sql
-- ============================================================

-- Create trigger function to cancel ZR Express order when status changes to 'erreur'
CREATE OR REPLACE FUNCTION public.trigger_zr_express_cancel_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _payload jsonb;
BEGIN
  -- Only trigger when status changes TO 'erreur'
  IF NEW.status != 'erreur' THEN
    RETURN NEW;
  END IF;

  -- Skip if old status was already 'erreur'
  IF TG_OP = 'UPDATE' AND OLD.status = 'erreur' THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://ggrnsnbxdslhlvanymgo.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncm5zbmJ4ZHNsaGx2YW55bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDI0ODEsImV4cCI6MjA4NzAxODQ4MX0.lhG7bhcR5ok7ZnlBxOrJNDNtYg9NydXggFTl6ldUFKk';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/zr-express-cancel-order',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;

-- Create trigger on orders table
CREATE TRIGGER trigger_zr_express_cancel_on_erreur
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'erreur' AND OLD.status IS DISTINCT FROM 'erreur')
  EXECUTE FUNCTION public.trigger_zr_express_cancel_order();


-- ============================================================
-- BEGIN 20260222000349_b21ccdd6-70b1-4d09-a85a-bc6cb1876f64.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_ecotrack_cancel_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _payload jsonb;
BEGIN
  -- Only trigger when status changes TO 'erreur'
  IF NEW.status != 'erreur' THEN
    RETURN NEW;
  END IF;

  -- Skip if old status was already 'erreur'
  IF TG_OP = 'UPDATE' AND OLD.status = 'erreur' THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://ggrnsnbxdslhlvanymgo.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncm5zbmJ4ZHNsaGx2YW55bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDI0ODEsImV4cCI6MjA4NzAxODQ4MX0.lhG7bhcR5ok7ZnlBxOrJNDNtYg9NydXggFTl6ldUFKk';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/ecotrack-cancel-order',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;

-- Create the trigger on orders table
CREATE TRIGGER trigger_ecotrack_cancel_on_erreur
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ecotrack_cancel_order();


-- ============================================================
-- BEGIN 20260222055729_4fd8ab81-b65c-45f9-aa97-17350ae0629b.sql
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;


-- ============================================================
-- BEGIN 20260223063505_32e756c4-7835-4302-a0f0-63e9950cc780.sql
-- ============================================================
ALTER TABLE public.local_livreurs ADD COLUMN tarif numeric NOT NULL DEFAULT 0;

-- ============================================================
-- BEGIN 20260223063822_65791939-ee2f-4ab5-8511-1b599731211d.sql
-- ============================================================
ALTER TABLE public.delivery_company_fees ADD COLUMN return_fee numeric NOT NULL DEFAULT 0;

-- ============================================================
-- BEGIN 20260223074249_81a9cf51-3cbb-44af-b84a-cc5e547bef1a.sql
-- ============================================================
ALTER TABLE public.customers ADD CONSTRAINT customers_phone_unique UNIQUE (phone);

-- ============================================================
-- BEGIN 20260224094833_faa04811-69bb-4c53-9e03-dc2ed056ea20.sql
-- ============================================================

-- Create special_delivery_fees table (for pricing tier special_1)
CREATE TABLE public.special_delivery_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wilaya_code TEXT NOT NULL,
  wilaya_name TEXT NOT NULL,
  home_delivery_fee NUMERIC NOT NULL DEFAULT 0,
  stop_desk_fee NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(wilaya_code)
);

-- Enable RLS
ALTER TABLE public.special_delivery_fees ENABLE ROW LEVEL SECURITY;

-- RLS policies matching other delivery fee tables
CREATE POLICY "Admins can delete special delivery fees"
  ON public.special_delivery_fees FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert special delivery fees"
  ON public.special_delivery_fees FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update special delivery fees"
  ON public.special_delivery_fees FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view special delivery fees"
  ON public.special_delivery_fees FOR SELECT
  USING (is_app_user(auth.uid()));

-- Populate with all 58 wilayas (same as delivery_fees)
INSERT INTO public.special_delivery_fees (wilaya_code, wilaya_name, home_delivery_fee, stop_desk_fee)
SELECT wilaya_code, wilaya_name, home_delivery_fee, stop_desk_fee
FROM public.delivery_fees;

-- Also update special_delivery_fees_2: set stop_desk_fee to 0 for "Gratuit au Bureau"
UPDATE public.special_delivery_fees_2 SET stop_desk_fee = 0;


-- ============================================================
-- BEGIN 20260225063942_a96b90b4-82fc-4dd6-b657-7f2147135a3b.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_assign_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _auto_enabled_raw text;
  _auto_enabled boolean;
  _mode text;
  _agents text[];
  _agent_name text;
  _min_count int;
  _min_agent text;
  _rr_index int;
  _count int;
  _a text;
  _current_dow int;
  _current_hour int;
  _work_start int;
  _work_end int;
  _working_hours jsonb;
  _is_during_work boolean;
BEGIN
  -- Check if auto-assignment is enabled
  SELECT trim(both '"' from setting_value::text) INTO _auto_enabled_raw
  FROM assignment_settings WHERE setting_key = 'auto_enabled';
  _auto_enabled := COALESCE(_auto_enabled_raw::boolean, false);
  IF NOT _auto_enabled THEN RETURN NEW; END IF;

  -- Skip if already assigned
  IF NEW.assigned_agent IS NOT NULL AND NEW.assigned_agent != '' THEN RETURN NEW; END IF;

  -- Check working hours (Algeria = UTC+1)
  SELECT setting_value INTO _working_hours
  FROM assignment_settings WHERE setting_key = 'working_hours';
  
  _work_start := COALESCE((_working_hours->>'start')::int, 8);
  _work_end := COALESCE((_working_hours->>'end')::int, 20);
  _current_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Algiers'));

  IF _work_start < _work_end THEN
    _is_during_work := _current_hour >= _work_start AND _current_hour < _work_end;
  ELSE
    -- Overnight range (e.g. 9 to 3)
    _is_during_work := _current_hour >= _work_start OR _current_hour < _work_end;
  END IF;

  -- Outside working hours: do NOT auto-assign
  IF NOT _is_during_work THEN RETURN NEW; END IF;

  -- Get active confirmateurs
  SELECT array_agg(COALESCE(p.full_name, p.email))
  INTO _agents
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'confirmateur' AND p.is_approved = true;

  IF _agents IS NULL OR array_length(_agents, 1) = 0 THEN RETURN NEW; END IF;

  -- Get assignment mode
  SELECT trim(both '"' from setting_value::text) INTO _mode
  FROM assignment_settings WHERE setting_key = 'mode';
  _mode := COALESCE(_mode, 'round_robin');

  _agent_name := NULL;

  IF _mode IN ('rules', 'combined') THEN
    -- Try source rules
    SELECT agent_name INTO _agent_name
    FROM assignment_rules
    WHERE rule_type = 'source' AND match_value = NEW.source::text AND is_active = true
    LIMIT 1;

    -- Try product rules
    IF _agent_name IS NULL THEN
      SELECT agent_name INTO _agent_name
      FROM assignment_rules ar
      WHERE ar.rule_type = 'product' AND ar.is_active = true
        AND EXISTS (
          SELECT 1 FROM order_items oi 
          WHERE oi.order_id = NEW.id AND oi.product_name = ar.match_value
        )
      LIMIT 1;
    END IF;

    -- Try schedule rules
    IF _agent_name IS NULL THEN
      _current_dow := EXTRACT(DOW FROM now());
      
      SELECT agent_name INTO _agent_name
      FROM assignment_rules
      WHERE rule_type = 'schedule'
        AND is_active = true
        AND _current_dow = ANY(days_of_week)
        AND _current_hour >= start_hour
        AND _current_hour < end_hour
      ORDER BY priority ASC
      LIMIT 1;
    END IF;
  END IF;

  -- Fallback
  IF _agent_name IS NULL THEN
    IF _mode IN ('workload', 'combined') THEN
      _min_count := 999999;
      FOREACH _a IN ARRAY _agents LOOP
        SELECT count(*) INTO _count FROM orders
        WHERE assigned_agent = _a 
        AND status NOT IN ('delivered', 'delivered_paid', 'cancelled', 'returned');
        IF _count < _min_count THEN
          _min_count := _count;
          _min_agent := _a;
        END IF;
      END LOOP;
      _agent_name := _min_agent;
    ELSE
      SELECT count(*) INTO _rr_index FROM orders;
      _agent_name := _agents[(_rr_index % array_length(_agents, 1)) + 1];
    END IF;
  END IF;

  NEW.assigned_agent := _agent_name;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_assign_order error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260225064141_df1fc515-8feb-4cba-bdd9-46964d9b59c6.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_assign_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _auto_enabled_raw text;
  _auto_enabled boolean;
  _mode text;
  _agents text[];
  _agent_name text;
  _min_count int;
  _min_agent text;
  _rr_index int;
  _count int;
  _a text;
  _current_dow int;
  _current_hour int;
  _work_start int;
  _work_end int;
  _working_hours jsonb;
  _is_during_work boolean;
  _auto_confirm_enabled boolean;
  _auto_confirm_raw jsonb;
BEGIN
  -- Check if auto-assignment is enabled
  SELECT trim(both '"' from setting_value::text) INTO _auto_enabled_raw
  FROM assignment_settings WHERE setting_key = 'auto_enabled';
  _auto_enabled := COALESCE(_auto_enabled_raw::boolean, false);
  IF NOT _auto_enabled THEN RETURN NEW; END IF;

  -- Skip if already assigned
  IF NEW.assigned_agent IS NOT NULL AND NEW.assigned_agent != '' THEN RETURN NEW; END IF;

  -- On INSERT (new order): skip if AI auto-confirmation is enabled
  -- Let the AI try to confirm first; the edge function auto-assign-stale-orders
  -- will assign later if AI doesn't confirm within the stale delay
  IF TG_OP = 'INSERT' THEN
    SELECT setting_value INTO _auto_confirm_raw
    FROM automation_settings WHERE setting_key = 'auto_confirm';
    
    IF _auto_confirm_raw IS NOT NULL AND (_auto_confirm_raw->>'enabled')::boolean = true THEN
      -- AI confirmation is active, don't assign immediately
      RETURN NEW;
    END IF;
  END IF;

  -- Check working hours (Algeria = UTC+1)
  SELECT setting_value INTO _working_hours
  FROM assignment_settings WHERE setting_key = 'working_hours';
  
  _work_start := COALESCE((_working_hours->>'start')::int, 8);
  _work_end := COALESCE((_working_hours->>'end')::int, 20);
  _current_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Algiers'));

  IF _work_start < _work_end THEN
    _is_during_work := _current_hour >= _work_start AND _current_hour < _work_end;
  ELSE
    _is_during_work := _current_hour >= _work_start OR _current_hour < _work_end;
  END IF;

  IF NOT _is_during_work THEN RETURN NEW; END IF;

  -- Get active confirmateurs
  SELECT array_agg(COALESCE(p.full_name, p.email))
  INTO _agents
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'confirmateur' AND p.is_approved = true;

  IF _agents IS NULL OR array_length(_agents, 1) = 0 THEN RETURN NEW; END IF;

  SELECT trim(both '"' from setting_value::text) INTO _mode
  FROM assignment_settings WHERE setting_key = 'mode';
  _mode := COALESCE(_mode, 'round_robin');

  _agent_name := NULL;

  IF _mode IN ('rules', 'combined') THEN
    SELECT agent_name INTO _agent_name
    FROM assignment_rules
    WHERE rule_type = 'source' AND match_value = NEW.source::text AND is_active = true
    LIMIT 1;

    IF _agent_name IS NULL THEN
      SELECT agent_name INTO _agent_name
      FROM assignment_rules ar
      WHERE ar.rule_type = 'product' AND ar.is_active = true
        AND EXISTS (
          SELECT 1 FROM order_items oi 
          WHERE oi.order_id = NEW.id AND oi.product_name = ar.match_value
        )
      LIMIT 1;
    END IF;

    IF _agent_name IS NULL THEN
      _current_dow := EXTRACT(DOW FROM now());
      SELECT agent_name INTO _agent_name
      FROM assignment_rules
      WHERE rule_type = 'schedule' AND is_active = true
        AND _current_dow = ANY(days_of_week)
        AND _current_hour >= start_hour AND _current_hour < end_hour
      ORDER BY priority ASC LIMIT 1;
    END IF;
  END IF;

  IF _agent_name IS NULL THEN
    IF _mode IN ('workload', 'combined') THEN
      _min_count := 999999;
      FOREACH _a IN ARRAY _agents LOOP
        SELECT count(*) INTO _count FROM orders
        WHERE assigned_agent = _a 
        AND status NOT IN ('delivered', 'delivered_paid', 'cancelled', 'returned');
        IF _count < _min_count THEN
          _min_count := _count;
          _min_agent := _a;
        END IF;
      END LOOP;
      _agent_name := _min_agent;
    ELSE
      SELECT count(*) INTO _rr_index FROM orders;
      _agent_name := _agents[(_rr_index % array_length(_agents, 1)) + 1];
    END IF;
  END IF;

  NEW.assigned_agent := _agent_name;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_assign_order error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260225082416_6c15790f-f84d-4fa5-a36f-6619f351f208.sql
-- ============================================================

SELECT cron.schedule(
  'auto-assign-stale-orders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ggrnsnbxdslhlvanymgo.supabase.co/functions/v1/auto-assign-stale-orders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncm5zbmJ4ZHNsaGx2YW55bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDI0ODEsImV4cCI6MjA4NzAxODQ4MX0.lhG7bhcR5ok7ZnlBxOrJNDNtYg9NydXggFTl6ldUFKk"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);


-- ============================================================
-- BEGIN 20260226065825_11f8d7a0-be1a-425f-894d-c43ad7a82558.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_assign_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _auto_enabled_raw text;
  _auto_enabled boolean;
  _mode text;
  _agents text[];
  _agent_name text;
  _min_count int;
  _min_agent text;
  _rr_index int;
  _count int;
  _a text;
  _current_dow int;
  _current_hour int;
  _work_start int;
  _work_end int;
  _working_hours jsonb;
  _is_during_work boolean;
  _auto_confirm_enabled boolean;
  _auto_confirm_raw jsonb;
BEGIN
  -- Check if auto-assignment is enabled
  SELECT trim(both '"' from setting_value::text) INTO _auto_enabled_raw
  FROM assignment_settings WHERE setting_key = 'auto_enabled';
  _auto_enabled := COALESCE(_auto_enabled_raw::boolean, false);
  IF NOT _auto_enabled THEN RETURN NEW; END IF;

  -- Skip if already assigned
  IF NEW.assigned_agent IS NOT NULL AND NEW.assigned_agent != '' THEN RETURN NEW; END IF;

  -- Check if AI auto-confirmation is enabled
  SELECT setting_value INTO _auto_confirm_raw
  FROM automation_settings WHERE setting_key = 'auto_confirm';
  _auto_confirm_enabled := (_auto_confirm_raw IS NOT NULL AND (_auto_confirm_raw->>'enabled')::boolean = true);

  -- On INSERT: if AI confirmation is enabled, skip (let AI try first)
  IF TG_OP = 'INSERT' AND _auto_confirm_enabled THEN
    RETURN NEW;
  END IF;

  -- If AI confirmation is DISABLED: assign immediately, no working hours check
  -- If AI confirmation is ENABLED (UPDATE path / stale): check working hours
  IF _auto_confirm_enabled THEN
    -- Check working hours (Algeria = UTC+1) only when AI is active
    SELECT setting_value INTO _working_hours
    FROM assignment_settings WHERE setting_key = 'working_hours';
    
    _work_start := COALESCE((_working_hours->>'start')::int, 8);
    _work_end := COALESCE((_working_hours->>'end')::int, 20);
    _current_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Algiers'));

    IF _work_start < _work_end THEN
      _is_during_work := _current_hour >= _work_start AND _current_hour < _work_end;
    ELSE
      _is_during_work := _current_hour >= _work_start OR _current_hour < _work_end;
    END IF;

    IF NOT _is_during_work THEN RETURN NEW; END IF;
  END IF;

  -- Get active confirmateurs
  SELECT array_agg(COALESCE(p.full_name, p.email))
  INTO _agents
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'confirmateur' AND p.is_approved = true;

  IF _agents IS NULL OR array_length(_agents, 1) = 0 THEN RETURN NEW; END IF;

  SELECT trim(both '"' from setting_value::text) INTO _mode
  FROM assignment_settings WHERE setting_key = 'mode';
  _mode := COALESCE(_mode, 'round_robin');

  _agent_name := NULL;

  IF _mode IN ('rules', 'combined') THEN
    SELECT agent_name INTO _agent_name
    FROM assignment_rules
    WHERE rule_type = 'source' AND match_value = NEW.source::text AND is_active = true
    LIMIT 1;

    IF _agent_name IS NULL THEN
      SELECT agent_name INTO _agent_name
      FROM assignment_rules ar
      WHERE ar.rule_type = 'product' AND ar.is_active = true
        AND EXISTS (
          SELECT 1 FROM order_items oi 
          WHERE oi.order_id = NEW.id AND oi.product_name = ar.match_value
        )
      LIMIT 1;
    END IF;

    IF _agent_name IS NULL THEN
      _current_dow := EXTRACT(DOW FROM now());
      _current_hour := COALESCE(_current_hour, EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Algiers'))::int);
      SELECT agent_name INTO _agent_name
      FROM assignment_rules
      WHERE rule_type = 'schedule' AND is_active = true
        AND _current_dow = ANY(days_of_week)
        AND _current_hour >= start_hour AND _current_hour < end_hour
      ORDER BY priority ASC LIMIT 1;
    END IF;
  END IF;

  IF _agent_name IS NULL THEN
    IF _mode IN ('workload', 'combined') THEN
      _min_count := 999999;
      FOREACH _a IN ARRAY _agents LOOP
        SELECT count(*) INTO _count FROM orders
        WHERE assigned_agent = _a 
        AND status NOT IN ('delivered', 'delivered_paid', 'cancelled', 'returned');
        IF _count < _min_count THEN
          _min_count := _count;
          _min_agent := _a;
        END IF;
      END LOOP;
      _agent_name := _min_agent;
    ELSE
      SELECT count(*) INTO _rr_index FROM orders;
      _agent_name := _agents[(_rr_index % array_length(_agents, 1)) + 1];
    END IF;
  END IF;

  NEW.assigned_agent := _agent_name;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_assign_order error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260226073135_1c162c67-5400-480a-84cc-8c442a888b21.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_assign_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _auto_enabled_raw text;
  _auto_enabled boolean;
  _mode text;
  _agents text[];
  _agent_name text;
  _min_count int;
  _min_agent text;
  _rr_index int;
  _count int;
  _a text;
  _current_dow int;
  _current_hour int;
  _work_start int;
  _work_end int;
  _working_hours jsonb;
  _is_during_work boolean;
  _auto_confirm_enabled boolean;
  _auto_confirm_raw jsonb;
BEGIN
  -- Check if auto-assignment is enabled
  SELECT trim(both '"' from setting_value::text) INTO _auto_enabled_raw
  FROM assignment_settings WHERE setting_key = 'auto_enabled';
  _auto_enabled := COALESCE(_auto_enabled_raw::boolean, false);
  IF NOT _auto_enabled THEN RETURN NEW; END IF;

  -- Skip if already assigned
  IF NEW.assigned_agent IS NOT NULL AND NEW.assigned_agent != '' THEN RETURN NEW; END IF;

  -- Check if AI auto-confirmation is enabled (key is 'confirmation', not 'auto_confirm')
  SELECT setting_value INTO _auto_confirm_raw
  FROM automation_settings WHERE setting_key = 'confirmation';
  _auto_confirm_enabled := (_auto_confirm_raw IS NOT NULL AND (_auto_confirm_raw->>'enabled')::boolean = true);

  -- On INSERT: if AI confirmation is enabled, skip (let AI try first)
  IF TG_OP = 'INSERT' AND _auto_confirm_enabled THEN
    RETURN NEW;
  END IF;

  -- If AI confirmation is DISABLED: assign immediately, no working hours check
  -- If AI confirmation is ENABLED (UPDATE path / stale): check working hours
  IF _auto_confirm_enabled THEN
    SELECT setting_value INTO _working_hours
    FROM assignment_settings WHERE setting_key = 'working_hours';
    
    _work_start := COALESCE((_working_hours->>'start')::int, 8);
    _work_end := COALESCE((_working_hours->>'end')::int, 20);
    _current_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Algiers'));

    IF _work_start < _work_end THEN
      _is_during_work := _current_hour >= _work_start AND _current_hour < _work_end;
    ELSE
      _is_during_work := _current_hour >= _work_start OR _current_hour < _work_end;
    END IF;

    IF NOT _is_during_work THEN RETURN NEW; END IF;
  END IF;

  -- Get active confirmateurs
  SELECT array_agg(COALESCE(p.full_name, p.email))
  INTO _agents
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'confirmateur' AND p.is_approved = true;

  IF _agents IS NULL OR array_length(_agents, 1) = 0 THEN RETURN NEW; END IF;

  SELECT trim(both '"' from setting_value::text) INTO _mode
  FROM assignment_settings WHERE setting_key = 'mode';
  _mode := COALESCE(_mode, 'round_robin');

  _agent_name := NULL;

  IF _mode IN ('rules', 'combined') THEN
    SELECT agent_name INTO _agent_name
    FROM assignment_rules
    WHERE rule_type = 'source' AND match_value = NEW.source::text AND is_active = true
    LIMIT 1;

    IF _agent_name IS NULL THEN
      SELECT agent_name INTO _agent_name
      FROM assignment_rules ar
      WHERE ar.rule_type = 'product' AND ar.is_active = true
        AND EXISTS (
          SELECT 1 FROM order_items oi 
          WHERE oi.order_id = NEW.id AND oi.product_name = ar.match_value
        )
      LIMIT 1;
    END IF;

    IF _agent_name IS NULL THEN
      _current_dow := EXTRACT(DOW FROM now());
      _current_hour := COALESCE(_current_hour, EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Algiers'))::int);
      SELECT agent_name INTO _agent_name
      FROM assignment_rules
      WHERE rule_type = 'schedule' AND is_active = true
        AND _current_dow = ANY(days_of_week)
        AND _current_hour >= start_hour AND _current_hour < end_hour
      ORDER BY priority ASC LIMIT 1;
    END IF;
  END IF;

  IF _agent_name IS NULL THEN
    IF _mode IN ('workload', 'combined') THEN
      _min_count := 999999;
      FOREACH _a IN ARRAY _agents LOOP
        SELECT count(*) INTO _count FROM orders
        WHERE assigned_agent = _a 
        AND status NOT IN ('delivered', 'delivered_paid', 'cancelled', 'returned');
        IF _count < _min_count THEN
          _min_count := _count;
          _min_agent := _a;
        END IF;
      END LOOP;
      _agent_name := _min_agent;
    ELSE
      SELECT count(*) INTO _rr_index FROM orders;
      _agent_name := _agents[(_rr_index % array_length(_agents, 1)) + 1];
    END IF;
  END IF;

  NEW.assigned_agent := _agent_name;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_assign_order error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- BEGIN 20260226073931_b5df4d20-43b5-41e3-bc04-79bfe9cd2e8f.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_assign_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _auto_enabled_raw text;
  _auto_enabled boolean;
  _mode text;
  _agents text[];
  _agent_name text;
  _min_count int;
  _min_agent text;
  _rr_index int;
  _count int;
  _a text;
  _current_dow int;
  _current_hour int;
  _work_start int;
  _work_end int;
  _working_hours jsonb;
  _is_during_work boolean;
  _auto_confirm_enabled boolean;
  _auto_confirm_raw jsonb;
  _instant_no_ai_raw text;
  _instant_no_ai boolean;
BEGIN
  -- Check if auto-assignment is enabled
  SELECT trim(both '"' from setting_value::text) INTO _auto_enabled_raw
  FROM assignment_settings WHERE setting_key = 'auto_enabled';
  _auto_enabled := COALESCE(_auto_enabled_raw::boolean, false);
  IF NOT _auto_enabled THEN RETURN NEW; END IF;

  -- Skip if already assigned
  IF NEW.assigned_agent IS NOT NULL AND NEW.assigned_agent != '' THEN RETURN NEW; END IF;

  -- Check if AI auto-confirmation is enabled
  SELECT setting_value INTO _auto_confirm_raw
  FROM automation_settings WHERE setting_key = 'confirmation';
  _auto_confirm_enabled := (_auto_confirm_raw IS NOT NULL AND (_auto_confirm_raw->>'enabled')::boolean = true);

  -- Check instant_assign_no_ai setting (default true)
  SELECT trim(both '"' from setting_value::text) INTO _instant_no_ai_raw
  FROM assignment_settings WHERE setting_key = 'instant_assign_no_ai';
  _instant_no_ai := COALESCE(_instant_no_ai_raw::boolean, true);

  -- On INSERT: if AI confirmation is enabled, skip (let AI try first)
  IF TG_OP = 'INSERT' AND _auto_confirm_enabled THEN
    RETURN NEW;
  END IF;

  -- If AI is DISABLED and instant_assign_no_ai is ON: assign immediately
  -- If AI is DISABLED and instant_assign_no_ai is OFF: check working hours
  -- If AI is ENABLED (UPDATE path / stale): check working hours
  IF _auto_confirm_enabled OR NOT _instant_no_ai THEN
    SELECT setting_value INTO _working_hours
    FROM assignment_settings WHERE setting_key = 'working_hours';
    
    _work_start := COALESCE((_working_hours->>'start')::int, 8);
    _work_end := COALESCE((_working_hours->>'end')::int, 20);
    _current_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Algiers'));

    IF _work_start < _work_end THEN
      _is_during_work := _current_hour >= _work_start AND _current_hour < _work_end;
    ELSE
      _is_during_work := _current_hour >= _work_start OR _current_hour < _work_end;
    END IF;

    IF NOT _is_during_work THEN RETURN NEW; END IF;
  END IF;

  -- Get active confirmateurs
  SELECT array_agg(COALESCE(p.full_name, p.email))
  INTO _agents
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'confirmateur' AND p.is_approved = true;

  IF _agents IS NULL OR array_length(_agents, 1) = 0 THEN RETURN NEW; END IF;

  SELECT trim(both '"' from setting_value::text) INTO _mode
  FROM assignment_settings WHERE setting_key = 'mode';
  _mode := COALESCE(_mode, 'round_robin');

  _agent_name := NULL;

  IF _mode IN ('rules', 'combined') THEN
    SELECT agent_name INTO _agent_name
    FROM assignment_rules
    WHERE rule_type = 'source' AND match_value = NEW.source::text AND is_active = true
    LIMIT 1;

    IF _agent_name IS NULL THEN
      SELECT agent_name INTO _agent_name
      FROM assignment_rules ar
      WHERE ar.rule_type = 'product' AND ar.is_active = true
        AND EXISTS (
          SELECT 1 FROM order_items oi 
          WHERE oi.order_id = NEW.id AND oi.product_name = ar.match_value
        )
      LIMIT 1;
    END IF;

    IF _agent_name IS NULL THEN
      _current_dow := EXTRACT(DOW FROM now());
      _current_hour := COALESCE(_current_hour, EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Algiers'))::int);
      SELECT agent_name INTO _agent_name
      FROM assignment_rules
      WHERE rule_type = 'schedule' AND is_active = true
        AND _current_dow = ANY(days_of_week)
        AND _current_hour >= start_hour AND _current_hour < end_hour
      ORDER BY priority ASC LIMIT 1;
    END IF;
  END IF;

  IF _agent_name IS NULL THEN
    IF _mode IN ('workload', 'combined') THEN
      _min_count := 999999;
      FOREACH _a IN ARRAY _agents LOOP
        SELECT count(*) INTO _count FROM orders
        WHERE assigned_agent = _a 
        AND status NOT IN ('delivered', 'delivered_paid', 'cancelled', 'returned');
        IF _count < _min_count THEN
          _min_count := _count;
          _min_agent := _a;
        END IF;
      END LOOP;
      _agent_name := _min_agent;
    ELSE
      SELECT count(*) INTO _rr_index FROM orders;
      _agent_name := _agents[(_rr_index % array_length(_agents, 1)) + 1];
    END IF;
  END IF;

  NEW.assigned_agent := _agent_name;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_assign_order error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- BEGIN 20260227102031_af7828f8-391f-4ea9-a405-0a69f88c5506.sql
-- ============================================================
ALTER TABLE public.auto_confirmation_logs DROP CONSTRAINT auto_confirmation_logs_conversation_status_check;

ALTER TABLE public.auto_confirmation_logs ADD CONSTRAINT auto_confirmation_logs_conversation_status_check 
CHECK (conversation_status = ANY (ARRAY['pending'::text, 'awaiting_reply'::text, 'confirmed'::text, 'cancelled'::text, 'expired'::text, 'manual_takeover'::text, 'awaiting_delivery_type'::text, 'contact_agent'::text, 'completed'::text]));

-- ============================================================
-- BEGIN 20260227111930_3a8b647d-124e-4bf4-9d5b-33754a690ca3.sql
-- ============================================================

-- Allow admins and stock managers to delete stock movements
CREATE POLICY "Admins can delete stock movements"
ON public.stock_movements
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Stock managers can delete stock movements"
ON public.stock_movements
FOR DELETE
USING (has_role(auth.uid(), 'stock_manager'::app_role));


-- ============================================================
-- BEGIN 20260227112657_a3c02e50-f4ea-4660-a19b-2121184c6318.sql
-- ============================================================

-- Add awaiting_stop_desk_selection to conversation_status constraint
ALTER TABLE public.auto_confirmation_logs 
DROP CONSTRAINT IF EXISTS auto_confirmation_logs_conversation_status_check;

ALTER TABLE public.auto_confirmation_logs 
ADD CONSTRAINT auto_confirmation_logs_conversation_status_check 
CHECK (conversation_status = ANY (ARRAY['pending', 'awaiting_reply', 'confirmed', 'cancelled', 'expired', 'manual_takeover', 'awaiting_delivery_type', 'contact_agent', 'completed', 'awaiting_stop_desk_selection']));


-- ============================================================
-- BEGIN 20260302171644_d3306501-ea21-48e7-ba50-d9f7c0428e2e.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_zr_express_create_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _payload jsonb;
BEGIN
  -- Only trigger when status changes to 'preparing'
  IF NEW.status != 'preparing' THEN
    RETURN NEW;
  END IF;

  -- Skip if old status was already 'preparing' (avoid re-triggering on other updates)
  IF TG_OP = 'UPDATE' AND OLD.status = 'preparing' THEN
    RETURN NEW;
  END IF;

  -- Skip if delivery_company is NOT ZR Express (e.g. local livreurs, RJ360, etc.)
  IF NEW.delivery_company IS NULL OR NEW.delivery_company != 'ZR Express' THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://ggrnsnbxdslhlvanymgo.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncm5zbmJ4ZHNsaGx2YW55bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDI0ODEsImV4cCI6MjA4NzAxODQ4MX0.lhG7bhcR5ok7ZnlBxOrJNDNtYg9NydXggFTl6ldUFKk';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/zr-express-create-order',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260303070235_c886ebeb-5a28-4d41-a9b1-d124dc0c3b3d.sql
-- ============================================================

-- Create product packs table
CREATE TABLE public.product_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  
  -- Conditions
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL DEFAULT 2,
  
  -- Multi-product pack (optional): list of product IDs that must ALL be in cart
  required_product_ids uuid[] DEFAULT '{}',
  
  -- Rewards
  discount_type text NOT NULL DEFAULT 'percentage', -- 'percentage', 'fixed_amount', 'fixed_price'
  discount_value numeric NOT NULL DEFAULT 0,
  free_delivery boolean NOT NULL DEFAULT false,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_packs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage product packs"
ON public.product_packs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view product packs"
ON public.product_packs FOR SELECT
USING (is_app_user(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_product_packs_updated_at
BEFORE UPDATE ON public.product_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- BEGIN 20260303072101_39b030f3-c7c7-410e-bd71-038f7bd1d70a.sql
-- ============================================================
ALTER TABLE public.product_packs ADD COLUMN price_tiers jsonb DEFAULT '[]'::jsonb;

-- ============================================================
-- BEGIN 20260303073118_b4df7646-77d8-497a-be1d-0079b3ebd72b.sql
-- ============================================================

ALTER TABLE public.product_packs 
ADD COLUMN gift_product_id uuid REFERENCES public.products(id) DEFAULT NULL,
ADD COLUMN gift_quantity integer NOT NULL DEFAULT 0;


-- ============================================================
-- BEGIN 20260303090943_95732c74-06ee-45b9-b733-73e6584e49da.sql
-- ============================================================
ALTER TABLE public.products ADD COLUMN ai_confirmation boolean NOT NULL DEFAULT true;

-- ============================================================
-- BEGIN 20260305024424_c5c70b70-1eec-4df9-b57f-9e8c0835cbdd.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_zr_express_ready()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _payload jsonb;
BEGIN
  IF NEW.status != 'ready' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'ready' THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_company IS NULL OR NEW.delivery_company != 'ZR Express' THEN
    RETURN NEW;
  END IF;

  IF NEW.tracking_number IS NULL THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://ggrnsnbxdslhlvanymgo.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncm5zbmJ4ZHNsaGx2YW55bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDI0ODEsImV4cCI6MjA4NzAxODQ4MX0.lhG7bhcR5ok7ZnlBxOrJNDNtYg9NydXggFTl6ldUFKk';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/zr-express-ready',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_order_ready_zr_express
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_zr_express_ready();


-- ============================================================
-- BEGIN 20260305024608_e23224b4-ff96-41e5-9196-194fda751528.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_zr_express_ready()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _payload jsonb;
BEGIN
  -- Trigger on 'ready' OR 'to_station'
  IF NEW.status NOT IN ('ready', 'to_station') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_company IS NULL OR NEW.delivery_company != 'ZR Express' THEN
    RETURN NEW;
  END IF;

  IF NEW.tracking_number IS NULL THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://ggrnsnbxdslhlvanymgo.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncm5zbmJ4ZHNsaGx2YW55bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDI0ODEsImV4cCI6MjA4NzAxODQ4MX0.lhG7bhcR5ok7ZnlBxOrJNDNtYg9NydXggFTl6ldUFKk';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/zr-express-ready',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260305124024_6537f0d9-6f0b-4ea8-9622-f046dce38177.sql
-- ============================================================
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_situation text;

-- ============================================================
-- BEGIN 20260306170857_ce0ac61a-7c4f-4a94-b786-59ecbf836d94.sql
-- ============================================================

-- Create a trigger function that calls zr-express-ready when order status changes to 'to_station'
CREATE OR REPLACE FUNCTION public.trigger_zr_express_ready_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only trigger for ZR Express orders transitioning to 'to_station'
  IF NEW.status = 'to_station' AND NEW.delivery_company = 'ZR Express'
     AND (OLD.status IS DISTINCT FROM 'to_station') THEN
    PERFORM net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/zr-express-ready',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_zr_express_ready_on_to_station ON public.orders;
CREATE TRIGGER trigger_zr_express_ready_on_to_station
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'to_station' AND OLD.status IS DISTINCT FROM 'to_station')
  EXECUTE FUNCTION public.trigger_zr_express_ready_order();


-- ============================================================
-- BEGIN 20260306172051_cc3bfb95-f1d3-44c0-82ac-fa1b80f32486.sql
-- ============================================================
-- Drop the broken trigger that uses vault secrets (which don't exist)
DROP TRIGGER IF EXISTS trigger_zr_express_ready_on_to_station ON public.orders;

-- Drop the broken function
DROP FUNCTION IF EXISTS public.trigger_zr_express_ready_order();

-- Update the working trigger function to also handle 'to_station' (it already does via the function body)
-- The existing on_order_ready_zr_express trigger already fires on ALL updates and the function checks for ready/to_station

-- ============================================================
-- BEGIN 20260306173414_6dd15e36-8d65-4ce0-b0a5-d60a45d863a9.sql
-- ============================================================
UPDATE orders SET status = 'confirmed' WHERE id = 'd6a2dac8-ee0d-4dad-928b-d1832371a84e';

-- ============================================================
-- BEGIN 20260306173420_d9c42e43-1b40-4afc-b8b7-943aa4b84d7d.sql
-- ============================================================
UPDATE orders SET status = 'to_station' WHERE id = 'd6a2dac8-ee0d-4dad-928b-d1832371a84e';

-- ============================================================
-- BEGIN 20260307125504_ae0675b5-f99a-4464-9e70-93041acd2388.sql
-- ============================================================
DELETE FROM deliveries WHERE id = 'd3877450-8cbf-4eef-b182-2759487c7fb3';

-- ============================================================
-- BEGIN 20260307133538_2dca76dc-81c3-4a13-a2ce-725f9d0b8cd6.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _changed_by text;
  _user_id uuid;
  _skip_trigger text;
  _duplicate_exists boolean;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Check if edge function wants to skip (it already inserted history manually)
    BEGIN
      _skip_trigger := current_setting('app.skip_order_history_trigger', true);
    EXCEPTION WHEN OTHERS THEN
      _skip_trigger := NULL;
    END;
    
    IF _skip_trigger = 'true' THEN
      RETURN NEW;
    END IF;

    -- Check for duplicate: same order, same transition, within last 3 seconds
    SELECT EXISTS (
      SELECT 1 FROM public.order_history
      WHERE order_id = NEW.id
        AND old_status = OLD.status
        AND new_status = NEW.status
        AND created_at > (now() - interval '3 seconds')
    ) INTO _duplicate_exists;
    
    IF _duplicate_exists THEN
      RETURN NEW;
    END IF;

    _user_id := auth.uid();
    
    -- Check for session variable set by edge functions
    BEGIN
      _changed_by := current_setting('app.changed_by', true);
    EXCEPTION WHEN OTHERS THEN
      _changed_by := NULL;
    END;
    
    -- Determine changed_by label
    IF _changed_by IS NOT NULL AND _changed_by != '' THEN
      NULL; -- keep _changed_by as is
    ELSIF _user_id IS NOT NULL THEN
      _changed_by := NULL; -- will be resolved from user profile in UI
    ELSE
      _changed_by := 'Système';
    END IF;
    
    INSERT INTO public.order_history (order_id, old_status, new_status, changed_by, changed_by_user_id)
    VALUES (
      NEW.id, 
      OLD.status, 
      NEW.status, 
      _changed_by,
      _user_id
    );
  END IF;
  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260307140928_60a6f0ae-7514-49ee-b1c8-46f30cd4034c.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_order_status_attributed(
  _order_id uuid,
  _status text,
  _changed_by text,
  _delivered_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('app.changed_by', _changed_by, true);
  
  IF _delivered_at IS NOT NULL THEN
    UPDATE orders SET status = _status::order_status, delivered_at = _delivered_at WHERE id = _order_id;
  ELSE
    UPDATE orders SET status = _status::order_status WHERE id = _order_id;
  END IF;
END;
$$;


-- ============================================================
-- BEGIN 20260308132827_62808ef3-1283-432f-aefc-bd4b1914e7dc.sql
-- ============================================================
-- Backfill delivery records for existing local livreur orders with poll votes
INSERT INTO deliveries (order_id, carrier, delivery_status, delivery_situation, last_update)
VALUES
  ('4c17aaa2-9668-4051-b3cb-4687ea2ba35b', 'local:Mouh', 'alerte', '🚚 Mouh: Réporter', now()),
  ('bea3289d-7570-466d-88d2-26b3ef174b6c', 'local:Mouh', 'delivered', '🚚 Mouh: Livré', now()),
  ('9f1ad07c-052b-40f4-84a4-b358e5865b29', 'local:Mouh', 'Échec_de_livraison', '👑 Admin: Retour', now()),
  ('ca822f6c-91ed-4ded-9966-aaec7ea6db38', 'local:Mouh', 'delivered', '👑 Admin: Livré', now()),
  ('2cfa975c-745c-4520-be04-bfe9d4336620', 'local:Mouh', 'delivered', '👑 Admin: Livré', now())
ON CONFLICT DO NOTHING;

-- ============================================================
-- BEGIN 20260308133107_f37e4399-9349-458c-8b80-7639d7e5f5b8.sql
-- ============================================================
-- Update existing delivery situations to show only the vote option
UPDATE deliveries 
SET delivery_situation = regexp_replace(delivery_situation, '^.*:\s*', '')
WHERE carrier LIKE 'local:%' AND delivery_situation IS NOT NULL;

-- ============================================================
-- BEGIN 20260309224230_3a1f009b-7f51-4f73-86a6-746c25983e4e.sql
-- ============================================================
SELECT cron.unschedule('zr-express-sync-statuses-cron');
SELECT cron.schedule(
  'zr-express-sync-statuses-cron',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := 'https://ggrnsnbxdslhlvanymgo.supabase.co/functions/v1/zr-express-sync-statuses',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncm5zbmJ4ZHNsaGx2YW55bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDI0ODEsImV4cCI6MjA4NzAxODQ4MX0.lhG7bhcR5ok7ZnlBxOrJNDNtYg9NydXggFTl6ldUFKk"}'::jsonb,
    body := '{}'::jsonb
  );$$
);

-- ============================================================
-- BEGIN 20260309224940_00938204-7db4-469e-af1b-864c60b6a98a.sql
-- ============================================================

-- Table for all Meta conversations (messages + comments)
CREATE TABLE public.meta_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL, -- 'facebook', 'instagram'
  conversation_type text NOT NULL DEFAULT 'message', -- 'message', 'comment'
  sender_id text NOT NULL, -- Meta user ID
  sender_name text, -- Display name
  sender_profile_pic text, -- Profile pic URL
  page_id text NOT NULL, -- Which page received this
  post_id text, -- For comments: the post ID
  thread_id text, -- Conversation thread ID
  last_message_at timestamptz DEFAULT now(),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table for individual messages within conversations
CREATE TABLE public.meta_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.meta_conversations(id) ON DELETE CASCADE NOT NULL,
  meta_message_id text, -- Original Meta message/comment ID
  direction text NOT NULL DEFAULT 'incoming', -- 'incoming', 'outgoing'
  content text,
  media_url text,
  media_type text, -- 'image', 'video', 'audio', 'file'
  is_comment boolean DEFAULT false,
  parent_comment_id text, -- For reply to comments
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_meta_conversations_platform ON public.meta_conversations(platform);
CREATE INDEX idx_meta_conversations_sender ON public.meta_conversations(sender_id);
CREATE INDEX idx_meta_conversations_last_msg ON public.meta_conversations(last_message_at DESC);
CREATE INDEX idx_meta_messages_conversation ON public.meta_messages(conversation_id);
CREATE INDEX idx_meta_messages_meta_id ON public.meta_messages(meta_message_id);

-- RLS
ALTER TABLE public.meta_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage meta conversations" ON public.meta_conversations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Confirmateurs can view meta conversations" ON public.meta_conversations FOR SELECT TO authenticated USING (has_role(auth.uid(), 'confirmateur'));

CREATE POLICY "Admins can manage meta messages" ON public.meta_messages FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Confirmateurs can view meta messages" ON public.meta_messages FOR SELECT TO authenticated USING (has_role(auth.uid(), 'confirmateur'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_messages;


-- ============================================================
-- BEGIN 20260309232628_d441246d-e425-4035-9470-6469b137e562.sql
-- ============================================================

CREATE TABLE public.conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.meta_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App users can view conversation notes"
  ON public.conversation_notes FOR SELECT TO authenticated
  USING (is_app_user(auth.uid()));

CREATE POLICY "App users can insert conversation notes"
  ON public.conversation_notes FOR INSERT TO authenticated
  WITH CHECK (is_app_user(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Admins can delete conversation notes"
  ON public.conversation_notes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR user_id = auth.uid());


-- ============================================================
-- BEGIN 20260312021322_f98e7ec4-b7e0-4490-943a-e3d6c755dbc4.sql
-- ============================================================
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'failed_4';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'failed_5';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'failed_6';

-- ============================================================
-- BEGIN 20260314054515_e4285719-4f61-4dd5-a56e-8fb8b4630017.sql
-- ============================================================
CREATE TABLE public.whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  has_whatsapp BOOLEAN NOT NULL DEFAULT true,
  contact_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read whatsapp_contacts"
  ON public.whatsapp_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage whatsapp_contacts"
  ON public.whatsapp_contacts FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- BEGIN 20260314063739_bb81e2d6-5052-4934-a37b-c9a926c6163c.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_check_whatsapp_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _existing boolean;
BEGIN
  -- Only on INSERT
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Skip if phone already cached
  SELECT EXISTS (
    SELECT 1 FROM whatsapp_contacts WHERE phone = NEW.customer_phone
  ) INTO _existing;

  IF _existing THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://ggrnsnbxdslhlvanymgo.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncm5zbmJ4ZHNsaGx2YW55bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDI0ODEsImV4cCI6MjA4NzAxODQ4MX0.lhG7bhcR5ok7ZnlBxOrJNDNtYg9NydXggFTl6ldUFKk';
  END IF;

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/wasender-check-whatsapp',
    body := jsonb_build_object('phone', NEW.customer_phone),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'trigger_check_whatsapp error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

-- Create the trigger on orders table
DROP TRIGGER IF EXISTS trg_check_whatsapp_on_order ON orders;
CREATE TRIGGER trg_check_whatsapp_on_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_whatsapp_on_order();


-- ============================================================
-- BEGIN 20260318131306_cea50f49-6f82-4660-a279-7df51a96f7f3.sql
-- ============================================================
ALTER TYPE public.customer_status ADD VALUE IF NOT EXISTS 'at_risk';

-- ============================================================
-- BEGIN 20260322081748_49ac099d-a91d-4314-9570-ec54a9628462.sql
-- ============================================================

CREATE TABLE public.charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'other',
  charge_date date NOT NULL DEFAULT CURRENT_DATE,
  is_recurring boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage charges" ON public.charges
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view charges" ON public.charges
  FOR SELECT TO authenticated
  USING (is_app_user(auth.uid()));


-- ============================================================
-- BEGIN 20260324095135_d2dc0a84-95da-4510-b034-dcf3d24c9d58.sql
-- ============================================================
ALTER TABLE public.local_livreurs ADD COLUMN return_tarif numeric NOT NULL DEFAULT 0;

-- ============================================================
-- BEGIN 20260324221043_dd381fa5-6736-4e99-bbbe-9246ce1f1447.sql
-- ============================================================

-- Function to recalculate customer stats from orders
CREATE OR REPLACE FUNCTION public.update_customer_stats(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE customers
  SET
    total_orders = COALESCE((
      SELECT COUNT(*) FROM orders 
      WHERE customer_id = p_customer_id 
      AND status NOT IN ('cancelled', 'duplicate')
    ), 0),
    total_spent = COALESCE((
      SELECT SUM(total_price) FROM orders 
      WHERE customer_id = p_customer_id 
      AND status IN ('delivered', 'delivered_paid')
    ), 0),
    last_order_date = (
      SELECT MAX(created_at) FROM orders 
      WHERE customer_id = p_customer_id
    ),
    updated_at = now()
  WHERE id = p_customer_id;
END;
$$;

-- Trigger function to auto-update customer stats when orders change
CREATE OR REPLACE FUNCTION public.trigger_update_customer_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM update_customer_stats(OLD.customer_id);
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM update_customer_stats(NEW.customer_id);
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id AND OLD.customer_id IS NOT NULL THEN
      PERFORM update_customer_stats(OLD.customer_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS orders_update_customer_stats ON orders;
CREATE TRIGGER orders_update_customer_stats
  AFTER INSERT OR UPDATE OF status, total_price, customer_id OR DELETE
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_customer_stats();

-- Backfill all existing customers with correct stats
UPDATE customers c
SET
  total_orders = COALESCE(s.order_count, 0),
  total_spent = COALESCE(s.spent, 0),
  last_order_date = s.last_date,
  updated_at = now()
FROM (
  SELECT 
    customer_id,
    COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'duplicate')) AS order_count,
    SUM(total_price) FILTER (WHERE status IN ('delivered', 'delivered_paid')) AS spent,
    MAX(created_at) AS last_date
  FROM orders
  WHERE customer_id IS NOT NULL
  GROUP BY customer_id
) s
WHERE c.id = s.customer_id;


-- ============================================================
-- BEGIN 20260325120455_09a046f2-01d1-486f-96a9-fa91a573a8b4.sql
-- ============================================================
-- Delete the duplicate 9-digit entry where a 10-digit version already exists
DELETE FROM customers 
WHERE id IN (
  SELECT c1.id 
  FROM customers c1
  JOIN customers c2 ON '0' || c1.phone = c2.phone
  WHERE length(c1.phone) = 9
);

-- Now safely prefix all remaining 9-digit phones with '0'
UPDATE customers SET phone = '0' || phone WHERE length(phone) = 9 AND phone NOT LIKE '0%';

-- ============================================================
-- BEGIN 20260327151547_8789f940-5dd3-4424-acc3-61a5ee1fe39e.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_zr_express_ready()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _payload jsonb;
BEGIN
  -- Only trigger on 'to_station' (not 'ready')
  IF NEW.status != 'to_station' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_company IS NULL OR NEW.delivery_company != 'ZR Express' THEN
    RETURN NEW;
  END IF;

  IF NEW.tracking_number IS NULL THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://ggrnsnbxdslhlvanymgo.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncm5zbmJ4ZHNsaGx2YW55bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDI0ODEsImV4cCI6MjA4NzAxODQ4MX0.lhG7bhcR5ok7ZnlBxOrJNDNtYg9NydXggFTl6ldUFKk';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/zr-express-ready',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;

-- ============================================================
-- BEGIN 20260328093834_fba56511-cf41-45e8-8a0e-6215e034f99f.sql
-- ============================================================

-- Fix 1: Remove overly permissive RLS policies on auto_confirmation_logs
DROP POLICY IF EXISTS "Service role can manage auto confirmation logs" ON public.auto_confirmation_logs;
DROP POLICY IF EXISTS "Allow insert from service role" ON public.auto_confirmation_logs;

-- Fix 2: Fix profiles update policy to prevent users from modifying is_approved
-- Drop existing policy
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;

-- Create new policy: users can update their own non-sensitive fields regardless of approval status
-- but cannot modify is_approved. Admins can update anything.
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (
  (id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN true
    WHEN id = auth.uid() THEN
      -- Non-admin users cannot change is_approved
      is_approved IS NOT DISTINCT FROM (SELECT p.is_approved FROM public.profiles p WHERE p.id = auth.uid())
    ELSE false
  END
);


-- ============================================================
-- BEGIN 20260328214420_5b1eb5a8-7e89-428f-a6a3-e794c7d0755a.sql
-- ============================================================

-- Drop existing policies on whatsapp_contacts
DROP POLICY IF EXISTS "Authenticated users can read whatsapp_contacts" ON whatsapp_contacts;
DROP POLICY IF EXISTS "Service role can manage whatsapp_contacts" ON whatsapp_contacts;

-- Create new stricter policies
CREATE POLICY "Authenticated users can view whatsapp contacts"
ON whatsapp_contacts FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert whatsapp contacts"
ON whatsapp_contacts FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update whatsapp contacts"
ON whatsapp_contacts FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete whatsapp contacts"
ON whatsapp_contacts FOR DELETE TO authenticated
USING (true);


-- ============================================================
-- BEGIN 20260328214428_94da033d-280f-4977-9927-582c949b1cf3.sql
-- ============================================================

-- Tighten write policies to app_user only (admins + approved users)
DROP POLICY IF EXISTS "Authenticated users can insert whatsapp contacts" ON whatsapp_contacts;
DROP POLICY IF EXISTS "Authenticated users can update whatsapp contacts" ON whatsapp_contacts;
DROP POLICY IF EXISTS "Authenticated users can delete whatsapp contacts" ON whatsapp_contacts;

CREATE POLICY "App users can insert whatsapp contacts"
ON whatsapp_contacts FOR INSERT TO authenticated
WITH CHECK (is_app_user(auth.uid()));

CREATE POLICY "App users can update whatsapp contacts"
ON whatsapp_contacts FOR UPDATE TO authenticated
USING (is_app_user(auth.uid()));

CREATE POLICY "Admins can delete whatsapp contacts"
ON whatsapp_contacts FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));


-- ============================================================
-- BEGIN 20260329100502_8410eb9d-abcf-474c-af8f-6c012be7f631.sql
-- ============================================================

-- Fix whatsapp_contacts SELECT policy: restrict to app users only
DROP POLICY IF EXISTS "Authenticated users can view whatsapp contacts" ON whatsapp_contacts;

CREATE POLICY "App users can view whatsapp contacts"
ON whatsapp_contacts FOR SELECT TO authenticated
USING (is_app_user(auth.uid()));


-- ============================================================
-- BEGIN 20260329102439_ee510801-f0b8-44ec-9181-773789e9b097.sql
-- ============================================================

-- Fix 1: Tighten profiles UPDATE policy so unapproved users cannot update their profile at all
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE TO public
USING (
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN true
    WHEN id = auth.uid() THEN is_app_user(auth.uid())
    ELSE false
  END
)
WITH CHECK (
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN true
    WHEN id = auth.uid() THEN (NOT (is_approved IS DISTINCT FROM (SELECT p.is_approved FROM profiles p WHERE p.id = auth.uid())))
    ELSE false
  END
);

-- Fix 2: Add explicit restrictive UPDATE policy on stock_movements to deny all updates
CREATE POLICY "No updates allowed on stock movements"
ON stock_movements FOR UPDATE TO public
USING (false)
WITH CHECK (false);


-- ============================================================
-- BEGIN 20260329152355_769c73df-a16e-4384-9b1d-8fe75c882211.sql
-- ============================================================
-- Tighten profiles self-update policy to make approval-state immutability explicit for non-admin users
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO public
USING (
  CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN true
    WHEN id = auth.uid() THEN public.is_app_user(auth.uid())
    ELSE false
  END
)
WITH CHECK (
  CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN true
    WHEN id = auth.uid() THEN (
      is_approved = (
        SELECT p.is_approved
        FROM public.profiles p
        WHERE p.id = auth.uid()
      )
    )
    ELSE false
  END
);

-- ============================================================
-- BEGIN 20260329160705_47e40a7f-723b-4740-b874-760301bc05bc.sql
-- ============================================================
-- Make chat-media bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-media';

-- Drop existing storage policies for chat-media if any
DROP POLICY IF EXISTS "Authenticated users can view chat media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete chat media" ON storage.objects;

-- Allow only authenticated users to read files
CREATE POLICY "Authenticated users can view chat media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

-- Allow only authenticated users to upload files
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

-- Allow only authenticated users to delete their files
CREATE POLICY "Authenticated users can delete chat media"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

-- Delete test orders created via unprotected webhooks
DELETE FROM order_items WHERE order_id IN (
  SELECT id FROM orders WHERE order_number IN ('ORD-00165', 'ORD-00171')
);
DELETE FROM order_history WHERE order_id IN (
  SELECT id FROM orders WHERE order_number IN ('ORD-00165', 'ORD-00171')
);
DELETE FROM orders WHERE order_number IN ('ORD-00165', 'ORD-00171');

-- ============================================================
-- BEGIN 20260329161230_63e51511-cf2d-47b7-80a5-a272474c339c.sql
-- ============================================================
UPDATE integrations SET api_secret = 'test-webhook-secret-2026' WHERE id = '4176be68-4801-481d-a2b8-2b9c50f171d0' AND name = 'LightFunnel';

-- ============================================================
-- BEGIN 20260329161258_8b049117-6658-47bc-b741-d5fa334a7727.sql
-- ============================================================
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number = 'ORD-00170');
DELETE FROM order_history WHERE order_id IN (SELECT id FROM orders WHERE order_number = 'ORD-00170');
DELETE FROM orders WHERE order_number = 'ORD-00170';
UPDATE integrations SET api_secret = NULL WHERE id = '4176be68-4801-481d-a2b8-2b9c50f171d0' AND name = 'LightFunnel';

-- ============================================================
-- BEGIN 20260329161823_ae997db0-2392-45f2-a33b-3bde1dd8336a.sql
-- ============================================================
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number = 'ORD-00170');
DELETE FROM order_history WHERE order_id IN (SELECT id FROM orders WHERE order_number = 'ORD-00170');
DELETE FROM orders WHERE order_number = 'ORD-00170';

-- ============================================================
-- BEGIN 20260403142928_e8e14f90-324b-43b5-858a-1b933f124226.sql
-- ============================================================

-- Update trigger_auto_confirm_order with new project URL and anon key
CREATE OR REPLACE FUNCTION public.trigger_auto_confirm_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _confirmation_enabled boolean;
  _base_url text;
  _anon_key text;
BEGIN
  SELECT (setting_value->>'enabled')::boolean INTO _confirmation_enabled
  FROM public.automation_settings
  WHERE setting_key = 'confirmation';

  IF COALESCE(_confirmation_enabled, false) = false THEN
    RETURN NEW;
  END IF;

  IF NEW.status != 'new' THEN
    RETURN NEW;
  END IF;

  _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/auto-confirm-orders',
    body := jsonb_build_object('orderIds', jsonb_build_array(NEW.id), 'mode', 'manual'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;

-- Update trigger_check_whatsapp_on_order with new project URL and anon key
CREATE OR REPLACE FUNCTION public.trigger_check_whatsapp_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _existing boolean;
BEGIN
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM whatsapp_contacts WHERE phone = NEW.customer_phone
  ) INTO _existing;

  IF _existing THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';
  END IF;

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/wasender-check-whatsapp',
    body := jsonb_build_object('phone', NEW.customer_phone),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'trigger_check_whatsapp error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

-- Update trigger_ecotrack_cancel_order with new project URL and anon key
CREATE OR REPLACE FUNCTION public.trigger_ecotrack_cancel_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _payload jsonb;
BEGIN
  IF NEW.status != 'erreur' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'erreur' THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/ecotrack-cancel-order',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;

-- Update trigger_notify_livreur with new project URL and anon key
CREATE OR REPLACE FUNCTION public.trigger_notify_livreur()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _payload jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_company IS NULL OR NOT starts_with(NEW.delivery_company, 'local:') THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';
  END IF;

  _payload := jsonb_build_object(
    'record', row_to_json(NEW)::jsonb,
    'old_record', row_to_json(OLD)::jsonb
  );

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/notify-livreur',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'trigger_notify_livreur error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

-- Update trigger_zr_express_cancel_order with new project URL and anon key
CREATE OR REPLACE FUNCTION public.trigger_zr_express_cancel_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _payload jsonb;
BEGIN
  IF NEW.status != 'erreur' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'erreur' THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/zr-express-cancel-order',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;

-- Update trigger_zr_express_create_order with new project URL and anon key
CREATE OR REPLACE FUNCTION public.trigger_zr_express_create_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _payload jsonb;
BEGIN
  IF NEW.status != 'preparing' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'preparing' THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_company IS NULL OR NEW.delivery_company != 'ZR Express' THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/zr-express-create-order',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;

-- Update trigger_zr_express_ready with new project URL and anon key
CREATE OR REPLACE FUNCTION public.trigger_zr_express_ready()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _payload jsonb;
BEGIN
  IF NEW.status != 'to_station' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_company IS NULL OR NEW.delivery_company != 'ZR Express' THEN
    RETURN NEW;
  END IF;

  IF NEW.tracking_number IS NULL THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';
  END IF;

  _payload := jsonb_build_object('record', row_to_json(NEW)::jsonb);

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/zr-express-ready',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )
  );

  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260403143621_e01b51a2-9fde-4f66-ae9d-f459a25db5fd.sql
-- ============================================================
UPDATE profiles SET is_approved = true WHERE email = 'outis.off@gmail.com';

-- ============================================================
-- BEGIN 20260403145359_51d134e9-ad10-44b5-a9d4-4e6f137e4e4c.sql
-- ============================================================

-- Drop all triggers first to avoid conflicts
DROP TRIGGER IF EXISTS update_assignment_rules_updated_at ON public.assignment_rules;
DROP TRIGGER IF EXISTS update_assignment_settings_updated_at ON public.assignment_settings;
DROP TRIGGER IF EXISTS update_auto_confirmation_logs_updated_at ON public.auto_confirmation_logs;
DROP TRIGGER IF EXISTS update_automation_settings_updated_at ON public.automation_settings;
DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
DROP TRIGGER IF EXISTS update_delivery_company_fees_updated_at ON public.delivery_company_fees;
DROP TRIGGER IF EXISTS update_delivery_fees_updated_at ON public.delivery_fees;
DROP TRIGGER IF EXISTS update_delivery_promotions_updated_at ON public.delivery_promotions;
DROP TRIGGER IF EXISTS update_google_tokens_updated_at ON public.google_tokens;
DROP TRIGGER IF EXISTS update_integrations_updated_at ON public.integrations;
DROP TRIGGER IF EXISTS update_meta_integration_updated_at ON public.meta_integration;
DROP TRIGGER IF EXISTS update_meta_pages_updated_at ON public.meta_pages;
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_special_delivery_fees_2_updated_at ON public.special_delivery_fees_2;
DROP TRIGGER IF EXISTS update_product_packs_updated_at ON public.product_packs;
DROP TRIGGER IF EXISTS auto_assign_order_trigger ON public.orders;
DROP TRIGGER IF EXISTS set_order_number ON public.orders;
DROP TRIGGER IF EXISTS log_order_status ON public.orders;
DROP TRIGGER IF EXISTS on_new_order_auto_confirm ON public.orders;
DROP TRIGGER IF EXISTS sync_order_stock ON public.orders;
DROP TRIGGER IF EXISTS on_order_preparing_zr_express ON public.orders;
DROP TRIGGER IF EXISTS trigger_zr_express_cancel_on_erreur ON public.orders;
DROP TRIGGER IF EXISTS trigger_ecotrack_cancel_on_erreur ON public.orders;
DROP TRIGGER IF EXISTS on_order_ready_zr_express ON public.orders;
DROP TRIGGER IF EXISTS trg_check_whatsapp_on_order ON public.orders;
DROP TRIGGER IF EXISTS trg_notify_livreur ON public.orders;
DROP TRIGGER IF EXISTS orders_update_customer_stats ON public.orders;

-- Recreate all triggers
CREATE TRIGGER update_assignment_rules_updated_at BEFORE UPDATE ON public.assignment_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assignment_settings_updated_at BEFORE UPDATE ON public.assignment_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_auto_confirmation_logs_updated_at BEFORE UPDATE ON public.auto_confirmation_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automation_settings_updated_at BEFORE UPDATE ON public.automation_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_delivery_company_fees_updated_at BEFORE UPDATE ON public.delivery_company_fees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_delivery_fees_updated_at BEFORE UPDATE ON public.delivery_fees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_delivery_promotions_updated_at BEFORE UPDATE ON public.delivery_promotions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_google_tokens_updated_at BEFORE UPDATE ON public.google_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meta_integration_updated_at BEFORE UPDATE ON public.meta_integration FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meta_pages_updated_at BEFORE UPDATE ON public.meta_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_special_delivery_fees_2_updated_at BEFORE UPDATE ON public.special_delivery_fees_2 FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_packs_updated_at BEFORE UPDATE ON public.product_packs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER auto_assign_order_trigger BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION auto_assign_order();
CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION generate_order_number();
CREATE TRIGGER log_order_status AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION log_order_status_change();
CREATE TRIGGER on_new_order_auto_confirm AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION trigger_auto_confirm_order();
CREATE TRIGGER sync_order_stock AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION handle_order_stock_sync();
CREATE TRIGGER on_order_preparing_zr_express AFTER INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION trigger_zr_express_create_order();
CREATE TRIGGER trigger_zr_express_cancel_on_erreur AFTER UPDATE ON public.orders FOR EACH ROW WHEN ((new.status = 'erreur'::order_status) AND (old.status IS DISTINCT FROM 'erreur'::order_status)) EXECUTE FUNCTION trigger_zr_express_cancel_order();
CREATE TRIGGER trigger_ecotrack_cancel_on_erreur AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION trigger_ecotrack_cancel_order();
CREATE TRIGGER on_order_ready_zr_express AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION trigger_zr_express_ready();
CREATE TRIGGER trg_check_whatsapp_on_order AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION trigger_check_whatsapp_on_order();
CREATE TRIGGER trg_notify_livreur AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION trigger_notify_livreur();
CREATE TRIGGER orders_update_customer_stats AFTER INSERT OR DELETE OR UPDATE OF status, total_price, customer_id ON public.orders FOR EACH ROW EXECUTE FUNCTION trigger_update_customer_stats();


-- ============================================================
-- BEGIN 20260403152840_6b041da8-07df-4996-8cb9-ad02a4613d80.sql
-- ============================================================

-- Clear old tracking numbers so the trigger can re-create them on ZR Express
UPDATE orders SET tracking_number = NULL WHERE order_number IN ('ORD-00101', 'ORD-00104');

-- Remove old delivery lock records
DELETE FROM deliveries WHERE id IN ('eaa9b1f8-55ef-4769-9cd0-c69abd11d632', '9a5e0c7d-f23f-4c2d-bdd9-4cee22e75375');


-- ============================================================
-- BEGIN 20260403152934_e9cba8e6-8aff-4113-95ca-92bf1d609962.sql
-- ============================================================

-- Temporarily set to confirmed then back to preparing to trigger zr-express-create-order
UPDATE orders SET status = 'confirmed' WHERE order_number IN ('ORD-00101', 'ORD-00104');


-- ============================================================
-- BEGIN 20260403152940_bc0bf72a-4dca-4ef9-b22a-7bac3083bc29.sql
-- ============================================================

-- Now set back to preparing to trigger the ZR Express create order function
UPDATE orders SET status = 'preparing' WHERE order_number IN ('ORD-00101', 'ORD-00104');


-- ============================================================
-- BEGIN 20260403172019_2f088157-797f-472d-aa92-2a5f67920b1a.sql
-- ============================================================

-- Performance indexes for orders table
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders USING btree (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_agent ON public.orders USING btree (assigned_agent);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders USING btree (customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_company ON public.orders USING btree (delivery_company);
CREATE INDEX IF NOT EXISTS idx_orders_wilaya ON public.orders USING btree (wilaya);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders USING btree (status, created_at DESC);

-- Performance indexes for order_items table
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items USING btree (product_id);

-- Performance indexes for order_history table
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON public.order_history USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON public.order_history USING btree (created_at DESC);

-- Performance indexes for stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON public.stock_movements USING btree (reference);

-- Performance indexes for customers
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers USING btree (status);

-- Performance indexes for deliveries
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON public.deliveries USING btree (order_id);

-- Performance indexes for charges
CREATE INDEX IF NOT EXISTS idx_charges_charge_date ON public.charges USING btree (charge_date);


-- ============================================================
-- BEGIN 20260403202346_1fde175e-a600-48bb-85d4-ac4d73154e30.sql
-- ============================================================
-- 1. Drop the public (unauthenticated) SELECT policy on chat-media
DROP POLICY IF EXISTS "Public can view chat media" ON storage.objects;

-- 2. Drop old INSERT/DELETE policies that lack ownership checks
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete chat media" ON storage.objects;

-- 3. Recreate INSERT policy with path-based ownership (files stored under user's uid folder)
CREATE POLICY "Authenticated users can upload own chat media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Recreate DELETE policy with path-based ownership
CREATE POLICY "Authenticated users can delete own chat media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Keep existing authenticated SELECT policy (already exists: "Authenticated users can view chat media")

-- ============================================================
-- BEGIN 20260403203514_d3a3cd9d-549e-4a77-8bca-fdb12f78ec08.sql
-- ============================================================

-- Fix 1: Remove stock_movements DELETE policies and make deletions impossible
DROP POLICY IF EXISTS "Stock managers can delete stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Admins can delete stock movements" ON public.stock_movements;

CREATE POLICY "No deletions on stock movements"
ON public.stock_movements FOR DELETE
USING (false);

-- Fix 2: Tighten chat-media SELECT to approved users only
DROP POLICY IF EXISTS "Authenticated users can view chat media" ON storage.objects;

CREATE POLICY "Approved users can view chat media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media'
  AND is_app_user(auth.uid())
);


-- ============================================================
-- BEGIN 20260403204927_5f52657a-cf25-495b-8d95-11b85c20cca4.sql
-- ============================================================

-- Fix 1: Tighten chat-media INSERT policy to require is_app_user
DROP POLICY IF EXISTS "Authenticated users can upload own chat media" ON storage.objects;
CREATE POLICY "Approved users can upload own chat media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-media'
  AND is_app_user(auth.uid())
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Fix 2: Tighten chat-media DELETE policy to require is_app_user
DROP POLICY IF EXISTS "Authenticated users can delete own chat media" ON storage.objects;
CREATE POLICY "Approved users can delete own chat media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-media'
  AND is_app_user(auth.uid())
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Fix 3: Simplify profile UPDATE policy to explicitly block is_approved changes for non-admins
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (
  CASE
    WHEN has_role(auth.uid(), 'admin') THEN true
    WHEN id = auth.uid() THEN is_app_user(auth.uid())
    ELSE false
  END
)
WITH CHECK (
  CASE
    WHEN has_role(auth.uid(), 'admin') THEN true
    WHEN id = auth.uid() THEN (
      is_approved = (SELECT p.is_approved FROM profiles p WHERE p.id = auth.uid())
      AND full_name IS NOT NULL
    )
    ELSE false
  END
);


-- ============================================================
-- BEGIN 20260403214103_dfd213c1-5683-48d8-8d6e-73aa71e4462a.sql
-- ============================================================

-- Fix: Restrict confirmateur SELECT on meta_messages to only messages in conversations they can access
-- And restrict confirmateur SELECT on meta_conversations to only conversations linked to orders assigned to them

-- Drop existing confirmateur policies
DROP POLICY IF EXISTS "Confirmateurs can view meta messages" ON public.meta_messages;
DROP POLICY IF EXISTS "Confirmateurs can view meta conversations" ON public.meta_conversations;

-- Recreate with scoped access: confirmateurs can only view meta_conversations
-- that have a sender matching a customer phone from orders assigned to them
CREATE POLICY "Confirmateurs can view meta conversations"
ON public.meta_conversations FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'confirmateur'::app_role)
  AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.assigned_agent = (
      SELECT COALESCE(p.full_name, p.email)
      FROM profiles p WHERE p.id = auth.uid()
    )
    AND o.customer_phone IS NOT NULL
  )
);

-- Confirmateurs can only view messages belonging to conversations they can access
CREATE POLICY "Confirmateurs can view meta messages"
ON public.meta_messages FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'confirmateur'::app_role)
  AND EXISTS (
    SELECT 1 FROM meta_conversations mc
    WHERE mc.id = meta_messages.conversation_id
  )
);


-- ============================================================
-- BEGIN 20260403221254_c1132e74-b00e-48db-8944-9b2a2b11e864.sql
-- ============================================================

-- Composite indexes for frequent query patterns

-- Orders: status + created_at (dashboard stats, filtered queries)
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON public.orders (status, created_at DESC);

-- Orders: assigned_agent + status (agent performance, confirmation page)
CREATE INDEX IF NOT EXISTS idx_orders_agent_status ON public.orders (assigned_agent, status) WHERE assigned_agent IS NOT NULL;

-- Orders: delivery_company + status (delivery stats)
CREATE INDEX IF NOT EXISTS idx_orders_delivery_company_status ON public.orders (delivery_company, status) WHERE delivery_company IS NOT NULL;

-- Orders: wilaya + status (wilaya-based reports)
CREATE INDEX IF NOT EXISTS idx_orders_wilaya_status ON public.orders (wilaya, status);

-- Orders: customer_phone (customer lookup, duplicate detection)
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders (customer_phone);

-- Orders: source (source filtering)
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders (source);

-- Order items: order_id + product_id (joins, product filtering)
CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON public.order_items (order_id, product_id);

-- Order history: order_id + created_at (status timeline)
CREATE INDEX IF NOT EXISTS idx_order_history_order_created ON public.order_history (order_id, created_at DESC);

-- Customers: phone (fast lookup)
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone);

-- Customers: status (filtering)
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers (status);

-- Stock movements: product_id + created_at (stock history)
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created ON public.stock_movements (product_id, created_at DESC);

-- Delivery company fees: company + wilaya (fee lookup)
CREATE INDEX IF NOT EXISTS idx_delivery_company_fees_lookup ON public.delivery_company_fees (delivery_company, wilaya_name);

-- Products: category (filtering)
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);


-- ============================================================
-- BEGIN 20260407135118_467aae41-759a-4f28-9359-b2daac1cf90a.sql
-- ============================================================

-- Fix overbroad confirmateur access to meta_conversations
-- Drop the old policy and create a properly scoped one
DROP POLICY IF EXISTS "Confirmateurs can view meta conversations" ON public.meta_conversations;

CREATE POLICY "Confirmateurs can view meta conversations"
ON public.meta_conversations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'confirmateur'::app_role)
  AND EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.assigned_agent = (
      SELECT COALESCE(p.full_name, p.email)
      FROM profiles p
      WHERE p.id = auth.uid()
    )
    AND o.customer_phone IS NOT NULL
    AND o.customer_phone = meta_conversations.sender_id
  )
);


-- ============================================================
-- BEGIN 20260407140342_888c9513-33ca-4374-8416-97b07c73dc0b.sql
-- ============================================================

-- 1. Add UPDATE policy on chat-media storage bucket to restrict file replacement to owner
CREATE POLICY "Only owner can update chat media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Add DELETE policy on auto_confirmation_logs for admins
CREATE POLICY "Admins can delete auto confirmation logs"
ON public.auto_confirmation_logs FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));


-- ============================================================
-- BEGIN 20260411123834_827a7595-1bb0-4988-a4f9-44d34f65ea69.sql
-- ============================================================
DROP TRIGGER IF EXISTS trg_notify_livreur ON public.orders;
DROP FUNCTION IF EXISTS public.trigger_notify_livreur();

-- ============================================================
-- BEGIN 20260413013801_d3dda494-4512-4353-963f-f80c03a1f18c.sql
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;

-- ============================================================
-- BEGIN 20260413013917_2a6b7b3d-7b02-4ece-ace9-eaf49120c27a.sql
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.auto_confirmation_logs;

-- ============================================================
-- BEGIN 20260415172100_33a634fc-1fa3-4f39-a2aa-fb0116fdd54f.sql
-- ============================================================
-- Create stores table
CREATE TABLE public.stores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage stores"
  ON public.stores FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view stores"
  ON public.stores FOR SELECT
  TO authenticated
  USING (is_app_user(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add store_id to orders
ALTER TABLE public.orders
  ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

-- ============================================================
-- BEGIN 20260415191030_b00b30e2-925b-41d4-ae90-291e5f29d671.sql
-- ============================================================
ALTER TABLE public.products ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE INDEX idx_products_store_id ON public.products(store_id);

-- ============================================================
-- BEGIN 20260415194239_59662e52-767a-4629-a505-a1b649f62e08.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_orders_updated_at_on_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at_on_status();


-- ============================================================
-- BEGIN 20260415194525_d6453619-856e-4b4b-be45-64ae71b82b05.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.backfill_orders_updated_at_from_history()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  WITH status_times AS (
    SELECT
      o.id,
      COALESCE(MAX(oh.created_at), o.created_at) AS corrected_updated_at
    FROM public.orders o
    LEFT JOIN public.order_history oh ON oh.order_id = o.id
    GROUP BY o.id, o.created_at
  )
  UPDATE public.orders o
  SET updated_at = st.corrected_updated_at
  FROM status_times st
  WHERE o.id = st.id
    AND o.updated_at IS DISTINCT FROM st.corrected_updated_at;
END;
$$;

-- ============================================================
-- BEGIN 20260415194549_a8d12315-fb78-430b-bf35-22eeccd679b9.sql
-- ============================================================
WITH status_times AS (
  SELECT
    o.id,
    COALESCE(MAX(oh.created_at), o.created_at) AS corrected_updated_at
  FROM public.orders o
  LEFT JOIN public.order_history oh ON oh.order_id = o.id
  GROUP BY o.id, o.created_at
)
UPDATE public.orders o
SET updated_at = st.corrected_updated_at
FROM status_times st
WHERE o.id = st.id
  AND o.updated_at IS DISTINCT FROM st.corrected_updated_at;

-- ============================================================
-- BEGIN 20260415194558_07754fa0-dd9f-4ead-9637-5e379a2a3829.sql
-- ============================================================
DROP FUNCTION IF EXISTS public.backfill_orders_updated_at_from_history();

-- ============================================================
-- BEGIN 20260415194600_b5418511-a278-4ad3-9b4a-3c44b41f7b95.sql
-- ============================================================
SELECT 1;

-- ============================================================
-- BEGIN 20260415194617_c950fd75-cc31-4868-9628-9f073d4bc959.sql
-- ============================================================
DROP FUNCTION IF EXISTS public.backfill_orders_updated_at_from_history();

-- ============================================================
-- BEGIN 20260415194620_c681d06f-e701-477d-a5ee-4593ec2e0f88.sql
-- ============================================================
WITH status_times AS (
  SELECT
    o.id,
    COALESCE(MAX(oh.created_at), o.created_at) AS corrected_updated_at
  FROM public.orders o
  LEFT JOIN public.order_history oh ON oh.order_id = o.id
  GROUP BY o.id, o.created_at
)
UPDATE public.orders o
SET updated_at = st.corrected_updated_at
FROM status_times st
WHERE o.id = st.id
  AND o.updated_at IS DISTINCT FROM st.corrected_updated_at;

-- ============================================================
-- BEGIN 20260415194623_896555cd-05f8-4ad0-89a8-1933f2babe5f.sql
-- ============================================================
SELECT 1;

-- ============================================================
-- BEGIN 20260415194631_17d4f672-6753-4c42-879a-211c86c3fdf1.sql
-- ============================================================
DROP FUNCTION IF EXISTS public.backfill_orders_updated_at_from_history();

-- ============================================================
-- BEGIN 20260415194639_4506dea7-8239-4895-9f8c-82e995f99d83.sql
-- ============================================================
SELECT 1;

-- ============================================================
-- BEGIN 20260415194641_9bb36d4b-31a2-47db-ae3e-e75831cd937f.sql
-- ============================================================
SELECT 1;

-- ============================================================
-- BEGIN 20260415194703_8eed0794-e197-4f31-94cc-41a0584ef027.sql
-- ============================================================
SELECT 1;

-- ============================================================
-- BEGIN 20260415194705_54f351d2-99d7-4d6f-b807-ae107baf7adc.sql
-- ============================================================
SELECT 1;

-- ============================================================
-- BEGIN 20260415194717_233fa6dd-8bc9-4d6a-b338-a35cb257021c.sql
-- ============================================================
SELECT 1;

-- ============================================================
-- BEGIN 20260415194726_f4eda769-f28a-4aa6-9be4-13d8534df23d.sql
-- ============================================================
SELECT 1;

-- ============================================================
-- BEGIN 20260415194734_0ceba510-fde8-4725-aee8-11601cff1beb.sql
-- ============================================================
SELECT 1;

-- ============================================================
-- BEGIN 20260417093943_1c82218a-ca8c-4c72-985f-0512e7a0720e.sql
-- ============================================================
-- Function: auto-fill delivered_at when status becomes delivered or delivered_paid
CREATE OR REPLACE FUNCTION public.set_delivered_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('delivered', 'delivered_paid')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on orders update
DROP TRIGGER IF EXISTS trg_set_delivered_at ON public.orders;
CREATE TRIGGER trg_set_delivered_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_delivered_at_on_status();

-- Backfill missing delivered_at using the most recent matching status change in order_history
UPDATE public.orders o
SET delivered_at = COALESCE(
  (SELECT MAX(oh.created_at) FROM public.order_history oh
    WHERE oh.order_id = o.id AND oh.new_status IN ('delivered', 'delivered_paid')),
  o.updated_at
)
WHERE o.status IN ('delivered', 'delivered_paid')
  AND o.delivered_at IS NULL;

-- ============================================================
-- BEGIN 20260420042742_09ec5816-bec6-4479-af30-3aa218ab232a.sql
-- ============================================================
DELETE FROM public.customers c
WHERE NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_phone = c.phone);

-- ============================================================
-- BEGIN 20260421085037_1a377f95-4455-4f91-a6ee-0425bc89fa3c.sql
-- ============================================================
ALTER TABLE public.charges
ADD COLUMN IF NOT EXISTS charge_type text NOT NULL DEFAULT 'fixe';

ALTER TABLE public.charges
DROP CONSTRAINT IF EXISTS charges_charge_type_check;

ALTER TABLE public.charges
ADD CONSTRAINT charges_charge_type_check CHECK (charge_type IN ('fixe', 'recurrente'));

CREATE INDEX IF NOT EXISTS idx_charges_charge_type ON public.charges(charge_type);

UPDATE public.charges SET charge_type = 'recurrente' WHERE is_recurring = true;

-- ============================================================
-- BEGIN 20260421085544_893b4c27-c73a-4e0e-8d28-2a6d11123ed3.sql
-- ============================================================
ALTER TABLE public.charges
ADD COLUMN IF NOT EXISTS charge_date_to date;

-- ============================================================
-- BEGIN 20260421085917_1c72d123-2d2c-49a8-b7b5-1439a2a81474.sql
-- ============================================================
ALTER TABLE public.charges
ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'one_time';

ALTER TABLE public.charges
DROP CONSTRAINT IF EXISTS charges_frequency_check;

ALTER TABLE public.charges
ADD CONSTRAINT charges_frequency_check CHECK (frequency IN ('one_time','weekly','monthly','yearly','per_order'));

CREATE INDEX IF NOT EXISTS idx_charges_frequency ON public.charges(frequency);

-- ============================================================
-- BEGIN 20260421093630_22381af7-4c27-4b67-9ad2-8232459cda9b.sql
-- ============================================================
-- Create charge_subcategories table
CREATE TABLE public.charge_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (category, name)
);

ALTER TABLE public.charge_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage charge subcategories"
ON public.charge_subcategories
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view charge subcategories"
ON public.charge_subcategories
FOR SELECT
TO authenticated
USING (is_app_user(auth.uid()));

CREATE TRIGGER update_charge_subcategories_updated_at
BEFORE UPDATE ON public.charge_subcategories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add subcategory column to charges
ALTER TABLE public.charges ADD COLUMN subcategory TEXT;

-- ============================================================
-- BEGIN 20260421094331_08b9bce9-fae8-44e4-9431-f4c6216387b6.sql
-- ============================================================
CREATE TABLE public.charge_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'slate',
  icon TEXT NOT NULL DEFAULT 'LayoutGrid',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.charge_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage charge categories"
ON public.charge_categories
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "App users can view charge categories"
ON public.charge_categories
FOR SELECT
TO authenticated
USING (is_app_user(auth.uid()));

CREATE TRIGGER update_charge_categories_updated_at
BEFORE UPDATE ON public.charge_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- BEGIN 20260421151821_f1ced971-9b69-4579-9683-c455f4147340.sql
-- ============================================================
-- 1. Rename meta_pages.page_access_token to page_access_token_encrypted for consistency
ALTER TABLE public.meta_pages 
  RENAME COLUMN page_access_token TO page_access_token_encrypted;

-- 2. Enable RLS on realtime.messages and restrict subscriptions to approved app users
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "App users can subscribe to realtime" ON realtime.messages;
CREATE POLICY "App users can subscribe to realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_app_user(auth.uid()));

-- 3. Restrict profiles update policy to authenticated role only
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  CASE
    WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN true
    WHEN (id = auth.uid()) THEN public.is_app_user(auth.uid())
    ELSE false
  END
)
WITH CHECK (
  CASE
    WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN true
    WHEN (id = auth.uid()) THEN (
      (is_approved = (SELECT p.is_approved FROM public.profiles p WHERE p.id = auth.uid()))
      AND (full_name IS NOT NULL)
    )
    ELSE false
  END
);

-- Also restrict the SELECT policy on profiles to authenticated
DROP POLICY IF EXISTS "App users can view profiles" ON public.profiles;
CREATE POLICY "App users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_app_user(auth.uid()));

-- ============================================================
-- BEGIN 20260421161708_8ee4c96f-d642-45ef-a172-49a9f6a1d371.sql
-- ============================================================
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_charges_store_id ON public.charges(store_id);
CREATE INDEX IF NOT EXISTS idx_charges_product_id ON public.charges(product_id);

-- ============================================================
-- BEGIN 20260423084111_bd720288-2b57-4522-bc61-00bd33e8102e.sql
-- ============================================================
DELETE FROM public.order_history a
WHERE a.changed_by = 'Système'
  AND EXISTS (
    SELECT 1 FROM public.order_history b
    WHERE b.order_id = a.order_id
      AND b.old_status = a.old_status
      AND b.new_status = a.new_status
      AND b.changed_by LIKE 'Livreur:%'
      AND abs(extract(epoch FROM (b.created_at - a.created_at))) < 5
  );

-- ============================================================
-- BEGIN 20260429150848_73c1f20c-d5a2-42e8-be8e-fad069e4c5eb.sql
-- ============================================================
-- Revoke EXECUTE on SECURITY DEFINER functions that are only invoked by triggers
-- or internally, never by clients via PostgREST. This addresses the Supabase
-- linter warnings about anon/authenticated being able to execute privileged
-- SECURITY DEFINER functions.

-- Trigger functions (only called by Postgres trigger machinery, not by clients)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_order_stock_sync() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.auto_assign_order() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_order_status_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_update_customer_stats() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_auto_confirm_order() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_check_whatsapp_on_order() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_ecotrack_cancel_order() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_zr_express_cancel_order() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_zr_express_create_order() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_zr_express_ready() FROM anon, authenticated, public;

-- Internal helpers — invoked by other server-side code, not by clients
REVOKE EXECUTE ON FUNCTION public.update_customer_stats(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_delivered_at_on_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_orders_updated_at_on_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM anon, authenticated, public;

-- Functions we KEEP callable (do not touch):
--   public.get_user_role(uuid)              -- called by client and many edge functions
--   public.update_order_status_attributed(...) -- called by edge functions with user JWT
--   public.has_role(uuid, app_role)         -- used inside RLS policies (needs EXECUTE for invoker)
--   public.is_app_user(uuid)                -- used inside RLS policies (needs EXECUTE for invoker)


-- ============================================================
-- BEGIN 20260503183223_7f0205ad-7d32-47dd-82d5-896c5826795d.sql
-- ============================================================

CREATE TABLE public.ai_chat_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Nouvelle conversation',
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_conversations_user ON public.ai_chat_conversations(user_id, updated_at DESC);

ALTER TABLE public.ai_chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conversations"
  ON public.ai_chat_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own conversations"
  ON public.ai_chat_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own conversations"
  ON public.ai_chat_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own conversations"
  ON public.ai_chat_conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_chat_conversations_updated_at
  BEFORE UPDATE ON public.ai_chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.ai_chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_messages_conv ON public.ai_chat_messages(conversation_id, created_at);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own chat messages"
  ON public.ai_chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own chat messages"
  ON public.ai_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own chat messages"
  ON public.ai_chat_messages FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- BEGIN 20260507045803_8e991670-e144-42ca-848d-eb523987ea8c.sql
-- ============================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_cancelled_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('cancelled','wrong_number','out_of_stock','no_answer')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.cancelled_at := now();
  ELSIF NEW.status NOT IN ('cancelled','wrong_number','out_of_stock','no_answer')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.cancelled_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_cancelled_at ON public.orders;
CREATE TRIGGER trg_set_cancelled_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_cancelled_at_on_status();

-- Backfill existing cancelled orders
UPDATE public.orders o
SET cancelled_at = COALESCE(
  (SELECT MAX(oh.created_at) FROM public.order_history oh
   WHERE oh.order_id = o.id
     AND oh.new_status IN ('cancelled','wrong_number','out_of_stock','no_answer')),
  o.updated_at
)
WHERE o.status IN ('cancelled','wrong_number','out_of_stock','no_answer')
  AND o.cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at ON public.orders(cancelled_at);


-- ============================================================
-- BEGIN 20260507053539_235d0dca-2d68-4ebb-9794-894f17bae158.sql
-- ============================================================
-- Add preparing_at column for accurate "Préparation" filtering
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS preparing_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_preparing_at ON public.orders(preparing_at);

-- Trigger function: set preparing_at when entering preparing/ready, clear when leaving
CREATE OR REPLACE FUNCTION public.set_preparing_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('preparing','ready')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.preparing_at := now();
  ELSIF NEW.status NOT IN ('preparing','ready')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.preparing_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_preparing_at ON public.orders;
CREATE TRIGGER trg_set_preparing_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_preparing_at_on_status();

-- Backfill: use latest order_history transition into preparing/ready, fallback to updated_at
UPDATE public.orders o
SET preparing_at = COALESCE(
  (SELECT MAX(oh.created_at) FROM public.order_history oh
    WHERE oh.order_id = o.id AND oh.new_status IN ('preparing','ready')),
  o.updated_at
)
WHERE o.status IN ('preparing','ready') AND o.preparing_at IS NULL;

-- ============================================================
-- BEGIN 20260507053817_e3fd9c6c-101a-44f6-923d-e4d01496e97d.sql
-- ============================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pending_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_orders_pending_at ON public.orders(pending_at);

CREATE OR REPLACE FUNCTION public.set_pending_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('new','failed_1','failed_2','failed_3','failed_4','failed_5','failed_6','postponed','to_reconfirm','callback','erreur')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.pending_at := now();
  ELSIF NEW.status NOT IN ('new','failed_1','failed_2','failed_3','failed_4','failed_5','failed_6','postponed','to_reconfirm','callback','erreur')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.pending_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_pending_at ON public.orders;
CREATE TRIGGER trg_set_pending_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_pending_at_on_status();

-- Initialize pending_at on insert for new pending orders
CREATE OR REPLACE FUNCTION public.set_pending_at_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('new','failed_1','failed_2','failed_3','failed_4','failed_5','failed_6','postponed','to_reconfirm','callback','erreur')
     AND NEW.pending_at IS NULL THEN
    NEW.pending_at := COALESCE(NEW.created_at, now());
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_pending_at_insert ON public.orders;
CREATE TRIGGER trg_set_pending_at_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_pending_at_on_insert();

-- Backfill existing pending orders
UPDATE public.orders o
SET pending_at = COALESCE(
  (SELECT MAX(oh.created_at) FROM public.order_history oh
    WHERE oh.order_id = o.id
      AND oh.new_status IN ('new','failed_1','failed_2','failed_3','failed_4','failed_5','failed_6','postponed','to_reconfirm','callback','erreur')),
  o.created_at
)
WHERE o.status IN ('new','failed_1','failed_2','failed_3','failed_4','failed_5','failed_6','postponed','to_reconfirm','callback','erreur')
  AND o.pending_at IS NULL;

-- ============================================================
-- BEGIN 20260507075935_947cdb4d-373a-49bf-b524-be523ad4cd15.sql
-- ============================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS returned_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.set_returned_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('Échec_de_livraison', 'returned')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.returned_at IS NULL THEN
    NEW.returned_at := now();
  ELSIF NEW.status NOT IN ('Échec_de_livraison', 'returned')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.returned_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_returned_at_trigger ON public.orders;
CREATE TRIGGER set_returned_at_trigger
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_returned_at_on_status();

-- Backfill: for existing returned/échec orders, set returned_at from updated_at
UPDATE public.orders
SET returned_at = updated_at
WHERE status IN ('Échec_de_livraison', 'returned')
  AND returned_at IS NULL;


-- ============================================================
-- BEGIN 20260507080939_3a033b54-24d2-41a3-b74a-2cee67d28b62.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_returned_at_on_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Set returned_at the FIRST time the order enters the return group, keep it stable afterwards
  IF NEW.status IN ('Échec_de_livraison', 'returned')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.returned_at IS NULL THEN
    NEW.returned_at := now();
  -- Clear only when leaving the return group entirely
  ELSIF NEW.status NOT IN ('Échec_de_livraison', 'returned')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.returned_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- BEGIN 20260507082926_feb3ddeb-dab8-4cfb-93d1-eae143ea6857.sql
-- ============================================================
-- Auto-set confirmed_at when status becomes 'confirmed'
CREATE OR REPLACE FUNCTION public.set_confirmed_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'confirmed'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.confirmed_at IS NULL THEN
    NEW.confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_confirmed_at_trigger ON public.orders;
CREATE TRIGGER set_confirmed_at_trigger
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_confirmed_at_on_status();

-- Auto-set shipped_at when status enters shipping group (first time only)
CREATE OR REPLACE FUNCTION public.set_shipped_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('shipped','to_station','at_station','au_bureau','en_livraison')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.shipped_at IS NULL THEN
    NEW.shipped_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_shipped_at_trigger ON public.orders;
CREATE TRIGGER set_shipped_at_trigger
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_shipped_at_on_status();

-- ============================================================
-- BEGIN 20260507083953_386cb599-9973-4276-b8fe-ded767e37dd7.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_assign_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _auto_enabled_raw text;
  _auto_enabled boolean;
  _mode text;
  _agents text[];
  _agent_name text;
  _min_count int;
  _min_agent text;
  _rr_index int;
  _count int;
  _a text;
  _current_dow int;
  _current_hour int;
  _work_start int;
  _work_end int;
  _working_hours jsonb;
  _is_during_work boolean;
  _auto_confirm_enabled boolean;
  _auto_confirm_raw jsonb;
  _instant_no_ai_raw text;
  _instant_no_ai boolean;
BEGIN
  SELECT trim(both '"' from setting_value::text) INTO _auto_enabled_raw
  FROM assignment_settings WHERE setting_key = 'auto_enabled';
  _auto_enabled := COALESCE(_auto_enabled_raw::boolean, false);
  IF NOT _auto_enabled THEN RETURN NEW; END IF;

  IF NEW.assigned_agent IS NOT NULL AND NEW.assigned_agent != '' THEN RETURN NEW; END IF;

  SELECT setting_value INTO _auto_confirm_raw
  FROM automation_settings WHERE setting_key = 'confirmation';
  _auto_confirm_enabled := (_auto_confirm_raw IS NOT NULL AND (_auto_confirm_raw->>'enabled')::boolean = true);

  SELECT trim(both '"' from setting_value::text) INTO _instant_no_ai_raw
  FROM assignment_settings WHERE setting_key = 'instant_assign_no_ai';
  _instant_no_ai := COALESCE(_instant_no_ai_raw::boolean, true);

  IF TG_OP = 'INSERT' AND _auto_confirm_enabled THEN
    RETURN NEW;
  END IF;

  IF _auto_confirm_enabled OR NOT _instant_no_ai THEN
    SELECT setting_value INTO _working_hours
    FROM assignment_settings WHERE setting_key = 'working_hours';
    
    _work_start := COALESCE((_working_hours->>'start')::int, 8);
    _work_end := COALESCE((_working_hours->>'end')::int, 20);
    _current_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Algiers'));

    IF _work_start < _work_end THEN
      _is_during_work := _current_hour >= _work_start AND _current_hour < _work_end;
    ELSE
      _is_during_work := _current_hour >= _work_start OR _current_hour < _work_end;
    END IF;

    IF NOT _is_during_work THEN RETURN NEW; END IF;
  END IF;

  SELECT array_agg(COALESCE(p.full_name, p.email))
  INTO _agents
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'confirmateur' AND p.is_approved = true;

  IF _agents IS NULL OR array_length(_agents, 1) = 0 THEN RETURN NEW; END IF;

  SELECT trim(both '"' from setting_value::text) INTO _mode
  FROM assignment_settings WHERE setting_key = 'mode';
  _mode := COALESCE(_mode, 'round_robin');

  _agent_name := NULL;

  IF _mode IN ('rules', 'combined') THEN
    SELECT agent_name INTO _agent_name
    FROM assignment_rules
    WHERE rule_type = 'source' AND match_value = NEW.source::text AND is_active = true
    LIMIT 1;

    IF _agent_name IS NULL THEN
      SELECT agent_name INTO _agent_name
      FROM assignment_rules ar
      WHERE ar.rule_type = 'product' AND ar.is_active = true
        AND EXISTS (
          SELECT 1 FROM order_items oi 
          WHERE oi.order_id = NEW.id AND oi.product_name = ar.match_value
        )
      LIMIT 1;
    END IF;

    IF _agent_name IS NULL THEN
      _current_dow := EXTRACT(DOW FROM (now() AT TIME ZONE 'Africa/Algiers'));
      _current_hour := COALESCE(_current_hour, EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Algiers'))::int);
      SELECT agent_name INTO _agent_name
      FROM assignment_rules
      WHERE rule_type = 'schedule' AND is_active = true
        AND _current_dow = ANY(days_of_week)
        AND _current_hour >= start_hour AND _current_hour < end_hour
      ORDER BY priority ASC LIMIT 1;
    END IF;
  END IF;

  IF _agent_name IS NULL THEN
    IF _mode IN ('workload', 'combined') THEN
      _min_count := 999999;
      FOREACH _a IN ARRAY _agents LOOP
        SELECT count(*) INTO _count FROM orders
        WHERE assigned_agent = _a 
        AND status NOT IN ('delivered', 'delivered_paid', 'cancelled', 'returned');
        IF _count < _min_count THEN
          _min_count := _count;
          _min_agent := _a;
        END IF;
      END LOOP;
      _agent_name := _min_agent;
    ELSE
      SELECT count(*) INTO _rr_index FROM orders;
      _agent_name := _agents[(_rr_index % array_length(_agents, 1)) + 1];
    END IF;
  END IF;

  NEW.assigned_agent := _agent_name;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_assign_order error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- BEGIN 20260510093205_5c5c9540-d62f-48fe-a185-71eacf2f2af9.sql
-- ============================================================

-- 1. Add new column
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_paid_at timestamp with time zone;

-- 2. Trigger function: set delivered_paid_at the first time the order enters delivered_paid
CREATE OR REPLACE FUNCTION public.set_delivered_paid_at_on_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'delivered_paid'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.delivered_paid_at IS NULL THEN
    NEW.delivered_paid_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Attach trigger
DROP TRIGGER IF EXISTS trg_set_delivered_paid_at ON public.orders;
CREATE TRIGGER trg_set_delivered_paid_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_delivered_paid_at_on_status();

-- 4. Backfill existing delivered_paid orders
UPDATE public.orders
SET delivered_paid_at = COALESCE(updated_at, delivered_at, now())
WHERE status = 'delivered_paid'
  AND delivered_paid_at IS NULL;


-- ============================================================
-- BEGIN 20260515171653_e45130ab-f6db-406f-8b29-1932f008cdd9.sql
-- ============================================================
SELECT public.update_order_status_attributed(
  (SELECT id FROM orders WHERE order_number='ORD-00413'),
  'delivered',
  'Correction manuelle (race condition)',
  now()
);

-- ============================================================
-- BEGIN 20260515173610_926628c1-a0ea-40b4-a019-f537f1e56b35.sql
-- ============================================================
ALTER TABLE public.deliveries 
ADD COLUMN IF NOT EXISTS livreur_poll_msg_id text,
ADD COLUMN IF NOT EXISTS livreur_poll_to text;

-- ============================================================
-- BEGIN 20260526044932_4ab71bb1-20c4-484b-b610-58d8ab76791a.sql
-- ============================================================
ALTER TABLE public.charges DROP CONSTRAINT IF EXISTS charges_frequency_check;
ALTER TABLE public.charges ADD CONSTRAINT charges_frequency_check CHECK (frequency = ANY (ARRAY['one_time'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text, 'per_order'::text, 'per_product'::text]));
ALTER TABLE public.charges ADD COLUMN IF NOT EXISTS product_ids uuid[];
CREATE INDEX IF NOT EXISTS idx_charges_product_ids ON public.charges USING GIN (product_ids);

-- ============================================================
-- BEGIN 20260529213401_12dd1002-63d1-425c-a500-45e06d47a436.sql
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- BEGIN 20260529215012_6e944f18-c9b6-4b40-a1e0-a00dd920fef8.sql
-- ============================================================
-- Add swap fee columns to delivery_company_fees
ALTER TABLE public.delivery_company_fees
  ADD COLUMN IF NOT EXISTS swap_same_wilaya_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS swap_diff_wilaya_fee numeric NOT NULL DEFAULT 0;

-- Seed ZR Express swap fees (flat rates across all wilayas)
UPDATE public.delivery_company_fees
SET swap_same_wilaya_fee = 50,
    swap_diff_wilaya_fee = 100,
    updated_at = now()
WHERE delivery_company = 'zr_express';

-- ============================================================
-- BEGIN 20260623141413_cfd312b5-f9ee-45fd-837e-ae86e3d53c9f.sql
-- ============================================================

-- Tighten meta_messages confirmateur policy to match meta_conversations scoping
DROP POLICY IF EXISTS "Confirmateurs can view meta messages" ON public.meta_messages;
CREATE POLICY "Confirmateurs can view meta messages"
ON public.meta_messages
FOR SELECT
USING (
  has_role(auth.uid(), 'confirmateur'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.meta_conversations mc
    JOIN public.orders o
      ON o.customer_phone IS NOT NULL
     AND o.customer_phone = mc.sender_id
    WHERE mc.id = meta_messages.conversation_id
      AND o.assigned_agent = (
        SELECT COALESCE(p.full_name, p.email)
        FROM public.profiles p
        WHERE p.id = auth.uid()
      )
  )
);

-- Lock down SECURITY DEFINER functions exposed via the API
REVOKE EXECUTE ON FUNCTION public.update_order_status_attributed(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_app_user(uuid) FROM PUBLIC, anon;


-- ============================================================
-- BEGIN 20260623142243_1ca67752-d66e-44f0-8a79-ceae69bf2310.sql
-- ============================================================
INSERT INTO public.automation_settings (setting_key, setting_value)
VALUES (
  'internal_trigger_secret',
  jsonb_build_object('value', encode(gen_random_bytes(32), 'hex'))
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = jsonb_build_object('value', encode(gen_random_bytes(32), 'hex'));

CREATE OR REPLACE FUNCTION public.trigger_auto_confirm_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _confirmation_enabled boolean;
  _base_url text;
  _anon_key text;
  _internal_secret text;
BEGIN
  SELECT (setting_value->>'enabled')::boolean INTO _confirmation_enabled
  FROM public.automation_settings
  WHERE setting_key = 'confirmation';

  IF COALESCE(_confirmation_enabled, false) = false THEN
    RETURN NEW;
  END IF;

  IF NEW.status != 'new' THEN
    RETURN NEW;
  END IF;

  _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';

  SELECT setting_value->>'value' INTO _internal_secret
  FROM public.automation_settings
  WHERE setting_key = 'internal_trigger_secret';

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/auto-confirm-orders',
    body := jsonb_build_object('orderIds', jsonb_build_array(NEW.id), 'mode', 'manual'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key,
      'x-internal-secret', COALESCE(_internal_secret, '')
    )
  );

  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260628060413_ddc7526a-1710-4479-8d7f-90b76e447284.sql
-- ============================================================

-- 1) Race-safe order numbers via SEQUENCE
CREATE SEQUENCE IF NOT EXISTS public.orders_number_seq;

-- Seed sequence above the current max so we never collide with existing ORD-XXXXX
SELECT setval(
  'public.orders_number_seq',
  GREATEST(
    COALESCE((
      SELECT MAX(CAST(SUBSTRING(order_number FROM 5) AS INTEGER))
      FROM public.orders
      WHERE order_number ~ '^ORD-[0-9]+$'
    ), 0),
    1
  ),
  true
);

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'ORD-' || LPAD(nextval('public.orders_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Tracking-number lookup index (used by webhooks and the global search)
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number
  ON public.orders (tracking_number)
  WHERE tracking_number IS NOT NULL;

-- 3) Realtime: full row payloads + publication for profile approval flips
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles';
  END IF;
END $$;

-- 4) Centralized internal HTTP-call helper so URL/anon-key live in one place
--    (replaces the literals duplicated across every trigger_* function)
CREATE OR REPLACE FUNCTION public.call_internal_function(
  _function_name text,
  _payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _base_url text;
  _anon_key text;
  _internal_secret text;
BEGIN
  _base_url := current_setting('app.settings.supabase_url', true);
  IF _base_url IS NULL OR _base_url = '' THEN
    _base_url := 'https://dccjwcwipcqlrspligyu.supabase.co';
  END IF;

  _anon_key := current_setting('app.settings.supabase_anon_key', true);
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjY2p3Y3dpcGNxbHJzcGxpZ3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjM5NTUsImV4cCI6MjA5MDc5OTk1NX0.KEHjGNGxceSMMrsnlBb2aLnOFfEII2lBBFFs8Pws_fI';
  END IF;

  SELECT setting_value->>'value' INTO _internal_secret
  FROM public.automation_settings
  WHERE setting_key = 'internal_trigger_secret';

  PERFORM net.http_post(
    url := _base_url || '/functions/v1/' || _function_name,
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key,
      'x-internal-secret', COALESCE(_internal_secret, '')
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.call_internal_function(text, jsonb) FROM PUBLIC, anon, authenticated;

-- 5) Refactor existing triggers to use the helper (single source of truth)
CREATE OR REPLACE FUNCTION public.trigger_auto_confirm_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _confirmation_enabled boolean;
BEGIN
  SELECT (setting_value->>'enabled')::boolean INTO _confirmation_enabled
  FROM public.automation_settings WHERE setting_key = 'confirmation';

  IF COALESCE(_confirmation_enabled, false) = false THEN RETURN NEW; END IF;
  IF NEW.status != 'new' THEN RETURN NEW; END IF;

  PERFORM public.call_internal_function(
    'auto-confirm-orders',
    jsonb_build_object('orderIds', jsonb_build_array(NEW.id), 'mode', 'manual')
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_check_whatsapp_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _existing boolean;
BEGIN
  IF TG_OP != 'INSERT' THEN RETURN NEW; END IF;

  SELECT EXISTS (SELECT 1 FROM whatsapp_contacts WHERE phone = NEW.customer_phone) INTO _existing;
  IF _existing THEN RETURN NEW; END IF;

  PERFORM public.call_internal_function(
    'wasender-check-whatsapp',
    jsonb_build_object('phone', NEW.customer_phone)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'trigger_check_whatsapp error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_zr_express_create_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status != 'preparing' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'preparing' THEN RETURN NEW; END IF;
  IF NEW.delivery_company IS NULL OR NEW.delivery_company != 'ZR Express' THEN RETURN NEW; END IF;

  PERFORM public.call_internal_function(
    'zr-express-create-order',
    jsonb_build_object('record', row_to_json(NEW)::jsonb)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_zr_express_cancel_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status != 'erreur' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'erreur' THEN RETURN NEW; END IF;

  PERFORM public.call_internal_function(
    'zr-express-cancel-order',
    jsonb_build_object('record', row_to_json(NEW)::jsonb)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_zr_express_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status != 'to_station' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.delivery_company IS NULL OR NEW.delivery_company != 'ZR Express' THEN RETURN NEW; END IF;
  IF NEW.tracking_number IS NULL THEN RETURN NEW; END IF;

  PERFORM public.call_internal_function(
    'zr-express-ready',
    jsonb_build_object('record', row_to_json(NEW)::jsonb)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_ecotrack_cancel_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status != 'erreur' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'erreur' THEN RETURN NEW; END IF;

  PERFORM public.call_internal_function(
    'ecotrack-cancel-order',
    jsonb_build_object('record', row_to_json(NEW)::jsonb)
  );
  RETURN NEW;
END;
$function$;


-- ============================================================
-- BEGIN 20260628060433_10e89d12-e46d-4c42-9280-df96764f50de.sql
-- ============================================================

-- Recreating a function re-grants EXECUTE to PUBLIC by default; revoke on all of them.
REVOKE EXECUTE ON FUNCTION public.call_internal_function(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_auto_confirm_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_check_whatsapp_on_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_zr_express_create_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_zr_express_cancel_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_zr_express_ready() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_ecotrack_cancel_order() FROM PUBLIC, anon, authenticated;


-- ============================================================
-- BEGIN 20260628090559_8cc9ac8a-232e-4991-8f36-84df23c64152.sql
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_confirmed_at ON public.orders (confirmed_at) WHERE confirmed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON public.orders (delivered_at) WHERE delivered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_delivered_paid_at ON public.orders (delivered_paid_at) WHERE delivered_paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_returned_at ON public.orders (returned_at) WHERE returned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_shipped_at ON public.orders (shipped_at) WHERE shipped_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON public.orders (updated_at);
-- Drop redundant duplicate (we already have idx_orders_status_created_at with same definition)
DROP INDEX IF EXISTS public.idx_orders_status_created;

-- ============================================================
-- BEGIN 20260628091945_56b41d30-ae8a-4d26-8232-05ae32f61c01.sql
-- ============================================================

-- 1. Create private schema, locked down
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- 2. Recreate the three security-definer helpers inside `private`
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_app_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND is_approved = true)
$$;

-- Lock execute to trusted roles only
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_user_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_app_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION private.get_user_role(uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION private.is_app_user(uuid) TO postgres, service_role;

-- 3. Rewrite every policy that referenced the public helpers to use the private ones
DO $rewrite$
DECLARE
  r RECORD;
  new_qual text;
  new_check text;
  roles_str text;
  sql_text text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE (qual ~ '(has_role|get_user_role|is_app_user)'
        OR with_check ~ '(has_role|get_user_role|is_app_user)')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    new_qual := regexp_replace(
      COALESCE(r.qual, ''),
      '(^|[^a-zA-Z0-9_.])(has_role|get_user_role|is_app_user)\s*\(',
      '\1private.\2(', 'g'
    );
    new_check := regexp_replace(
      COALESCE(r.with_check, ''),
      '(^|[^a-zA-Z0-9_.])(has_role|get_user_role|is_app_user)\s*\(',
      '\1private.\2(', 'g'
    );

    SELECT string_agg(quote_ident(role_name), ', ')
      INTO roles_str
      FROM unnest(r.roles) AS role_name;
    IF roles_str IS NULL OR roles_str = '' THEN
      roles_str := 'public';
    END IF;

    sql_text := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      r.policyname, r.schemaname, r.tablename,
      r.permissive, r.cmd, roles_str
    );

    IF r.qual IS NOT NULL THEN
      sql_text := sql_text || ' USING (' || new_qual || ')';
    END IF;
    IF r.with_check IS NOT NULL THEN
      sql_text := sql_text || ' WITH CHECK (' || new_check || ')';
    END IF;

    EXECUTE sql_text;
  END LOOP;
END
$rewrite$;

-- 4. Drop the public versions now that nothing references them.
--    Keep a service-role-only compatibility shim for `public.get_user_role` because
--    several edge functions still call it via RPC with the service role key.
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_app_user(uuid);

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO service_role;


-- ============================================================
-- BEGIN 20260628092358_5c2cad12-41b1-4699-81d3-ca6b79ee9fd7.sql
-- ============================================================
GRANT USAGE ON SCHEMA private TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_app_user(uuid) TO authenticated;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;

-- ============================================================
-- BEGIN 20260708232433_5209d7e5-4fe1-4ef5-ade6-a96d8aece0f1.sql
-- ============================================================
SELECT public.update_order_status_attributed(
  (SELECT id FROM public.orders WHERE order_number = 'LF-5961'),
  'delivered',
  'Système (sync manuelle ZR)',
  now()
);

UPDATE public.deliveries
SET delivery_status = 'Livré',
    delivery_situation = 'Livré',
    last_update = now()
WHERE order_id = (SELECT id FROM public.orders WHERE order_number = 'LF-5961');


-- ============================================================
-- POST-MIGRATION: auth.users trigger (not creatable via Lovable migrations)
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
