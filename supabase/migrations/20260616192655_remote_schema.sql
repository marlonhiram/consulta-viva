


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."consultation_status_enum" AS ENUM (
    'triagem',
    'aguardando_analise',
    'agendada',
    'em_andamento',
    'concluida',
    'cancelada',
    'fotos_recusadas'
);


ALTER TYPE "public"."consultation_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."consultation_type_enum" AS ENUM (
    'gratuita_basica',
    'premium_chat'
);


ALTER TYPE "public"."consultation_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."hand_dominance_enum" AS ENUM (
    'destro',
    'canhoto'
);


ALTER TYPE "public"."hand_dominance_enum" OWNER TO "postgres";


CREATE TYPE "public"."hand_type_enum" AS ENUM (
    'direita',
    'esquerda',
    'perfil'
);


ALTER TYPE "public"."hand_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."message_type_enum" AS ENUM (
    'text',
    'system',
    'action',
    'image'
);


ALTER TYPE "public"."message_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."payment_status_enum" AS ENUM (
    'pending',
    'paid',
    'failed',
    'refunded'
);


ALTER TYPE "public"."payment_status_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_chat_room"("p_consultation_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.consultations
    SET
        status   = 'concluida',
        ended_at = NOW()     -- SUGESTÃO #1 aplicada aqui
    WHERE
        id     = p_consultation_id
        AND status = 'em_andamento'; -- Garante idempotência: só encerra se estava ativa

    -- Insere mensagem de sistema marcando o encerramento
    INSERT INTO public.messages (consultation_id, content, message_type, is_ai)
    VALUES (
        p_consultation_id,
        'A sessão foi encerrada automaticamente. Obrigada pela consulta.',
        'system',
        FALSE
    );
END;
$$;


ALTER FUNCTION "public"."close_chat_room"("p_consultation_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."close_chat_room"("p_consultation_id" "uuid") IS 'Encerra a sala de chat de forma atômica: atualiza status, registra ended_at e insere mensagem de sistema no log.';



CREATE OR REPLACE FUNCTION "public"."confirm_payment"("p_gateway_id" character varying, "p_status" "public"."payment_status_enum") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_consultation_id UUID;
BEGIN
    -- Atualiza o status do pagamento
    UPDATE public.payments
    SET    status = p_status, updated_at = NOW()
    WHERE  gateway_id = p_gateway_id
    RETURNING consultation_id INTO v_consultation_id;

    -- Se aprovado, libera a consulta
    IF p_status = 'paid' AND v_consultation_id IS NOT NULL THEN
        UPDATE public.consultations
        SET    is_paid = TRUE, status = 'agendada'
        WHERE  id = v_consultation_id;
    END IF;
END;
$$;


ALTER FUNCTION "public"."confirm_payment"("p_gateway_id" character varying, "p_status" "public"."payment_status_enum") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."confirm_payment"("p_gateway_id" character varying, "p_status" "public"."payment_status_enum") IS 'Chamada pelo webhook do Mercado Pago/Stripe via service_role. Atualiza o pagamento e libera a consulta em uma transação atômica.';



CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  ELSE
    claims := jsonb_set(claims, '{user_role}', '"client"');
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;


ALTER FUNCTION "public"."custom_access_token_hook"("event" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."incrementar_usadas"("promo_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE promocoes
  SET usadas = usadas + 1
  WHERE id = promo_id
    AND ativa = true
    AND usadas < limite;
END;
$$;


ALTER FUNCTION "public"."incrementar_usadas"("promo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_message_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RAISE EXCEPTION
        'Operação proibida: mensagens são imutáveis. Tentativa de % na tabela messages bloqueada.',
        TG_OP;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."prevent_message_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agenda_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "reason" "text",
    "type" "text" DEFAULT 'manual'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agenda_blocks_type_check" CHECK (("type" = ANY (ARRAY['manual'::"text", 'presencial'::"text", 'bloqueado'::"text"])))
);


ALTER TABLE "public"."agenda_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agenda_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_days" integer[] DEFAULT '{1,2,3,4,5,6}'::integer[],
    "start_time" time without time zone DEFAULT '09:00:00'::time without time zone,
    "end_time" time without time zone DEFAULT '18:00:00'::time without time zone,
    "slot_duration_minutes" integer DEFAULT 30,
    "break_between_minutes" integer DEFAULT 5,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "leitura_gratuita_ativa" boolean DEFAULT true
);


ALTER TABLE "public"."agenda_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consultations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "public"."consultation_status_enum" DEFAULT 'triagem'::"public"."consultation_status_enum" NOT NULL,
    "scheduled_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "analysis_summary" "text",
    "is_paid" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "photo_rejection_reason" "text",
    "photo_rejection_count" smallint DEFAULT 0,
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "cancelled_by" "text",
    "tipo" "text" DEFAULT 'premium'::"text",
    CONSTRAINT "consultations_cancelled_by_check" CHECK (("cancelled_by" = ANY (ARRAY['client'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."consultations" OWNER TO "postgres";


COMMENT ON TABLE "public"."consultations" IS 'Núcleo do processo. Cada consulta (gratuita ou premium) é um registro aqui.';



COMMENT ON COLUMN "public"."consultations"."ended_at" IS 'Preenchido quando o cronômetro chega a zero ou a sala é encerrada manualmente. Essencial para relatório de ganhos.';



COMMENT ON COLUMN "public"."consultations"."analysis_summary" IS 'Texto rico (HTML) redigido pela especialista no painel admin (L06). Enviado ao cliente via Resend.';



COMMENT ON COLUMN "public"."consultations"."is_paid" IS 'Setado para TRUE via webhook do gateway de pagamento. Libera o acesso à agenda e ao chat.';



CREATE TABLE IF NOT EXISTS "public"."credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "consultation_id" "uuid",
    "origin" "text" NOT NULL,
    "amount" numeric(10,2) DEFAULT 100.00 NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "used_at" timestamp with time zone,
    "used_for_consultation_id" "uuid",
    "refund_requested_at" timestamp with time zone,
    "refunded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "credits_origin_check" CHECK (("origin" = ANY (ARRAY['payment'::"text", 'cancellation_refund'::"text"]))),
    CONSTRAINT "credits_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'used'::"text", 'refund_requested'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nome" "text" NOT NULL,
    "email" "text",
    "telefone" "text" NOT NULL,
    "tipo" "text" DEFAULT 'gratuita'::"text",
    "status" "text" DEFAULT 'novo'::"text",
    "wa_id" "text",
    "consultation_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "consultation_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "content" "text" NOT NULL,
    "is_ai" boolean DEFAULT false NOT NULL,
    "message_type" "public"."message_type_enum" DEFAULT 'text'::"public"."message_type_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."messages" IS 'Log imutável de todas as interações. Só aceita INSERT e SELECT. Proibido UPDATE e DELETE.';



COMMENT ON COLUMN "public"."messages"."sender_id" IS 'NULL quando a mensagem foi gerada pelo sistema ou pela IA de triagem.';



COMMENT ON COLUMN "public"."messages"."is_ai" IS 'TRUE para mensagens geradas pelo Gemini durante a triagem automatizada.';



COMMENT ON COLUMN "public"."messages"."message_type" IS 'Define a renderização no frontend: text=balão normal, system=aviso centralizado, action=evento de log.';



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "consultation_id" "uuid" NOT NULL,
    "gateway_id" character varying(255),
    "amount" numeric(10,2) NOT NULL,
    "status" "public"."payment_status_enum" DEFAULT 'pending'::"public"."payment_status_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."payments" IS 'Registro financeiro de cada tentativa de pagamento. Atualizado pelo webhook do gateway.';



COMMENT ON COLUMN "public"."payments"."gateway_id" IS 'ID único gerado pelo Mercado Pago ou Stripe. Usado para reconciliar webhooks recebidos.';



CREATE TABLE IF NOT EXISTS "public"."photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "consultation_id" "uuid" NOT NULL,
    "storage_url" "text" NOT NULL,
    "hand_type" "public"."hand_type_enum" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text"
);


ALTER TABLE "public"."photos" OWNER TO "postgres";


COMMENT ON TABLE "public"."photos" IS 'Fotos das mãos vinculadas a uma consulta. A storage_url referencia o bucket privado do Supabase Storage.';



COMMENT ON COLUMN "public"."photos"."storage_url" IS 'Caminho relativo no bucket. URLs assinadas (60 min de validade) são geradas sob demanda pela API, nunca expostas diretamente.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "birth_date" "date",
    "hand_dominance" "public"."hand_dominance_enum",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cpf" "text",
    "phone" character varying(20),
    "cancel_token" "uuid"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Dados de identidade do cliente, vinculados ao Auth do Supabase.';



COMMENT ON COLUMN "public"."profiles"."hand_dominance" IS 'Determina qual mão é dominante para a leitura. Coletado pelo chatbot de triagem.';



CREATE TABLE IF NOT EXISTS "public"."promocoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" DEFAULT 'leitura_gratuita'::"text",
    "limite" integer NOT NULL,
    "usadas" integer DEFAULT 0,
    "expira_em" timestamp with time zone NOT NULL,
    "ativa" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."promocoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'client'::"text" NOT NULL,
    CONSTRAINT "user_roles_role_check" CHECK (("role" = ANY (ARRAY['client'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_roles" IS 'Controla o papel de cada usuário. Lido pelo hook de JWT para injetar user_role no token. Para dar acesso admin à especialista: INSERT INTO user_roles (user_id, role) VALUES (<uuid_dela>, ''admin'');';



ALTER TABLE ONLY "public"."agenda_blocks"
    ADD CONSTRAINT "agenda_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agenda_config"
    ADD CONSTRAINT "agenda_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credits"
    ADD CONSTRAINT "credits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_gateway_id_key" UNIQUE ("gateway_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_cpf_key" UNIQUE ("cpf");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promocoes"
    ADD CONSTRAINT "promocoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "idx_consultations_status" ON "public"."consultations" USING "btree" ("status", "scheduled_at");



CREATE INDEX "idx_consultations_user_id" ON "public"."consultations" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_messages_consultation_created" ON "public"."messages" USING "btree" ("consultation_id", "created_at");



COMMENT ON INDEX "public"."idx_messages_consultation_created" IS 'Crítico para performance. Carrega o histórico de uma sala de chat em ordem cronológica.';



CREATE INDEX "idx_payments_gateway_id" ON "public"."payments" USING "btree" ("gateway_id");



CREATE INDEX "idx_photos_consultation_id" ON "public"."photos" USING "btree" ("consultation_id");



CREATE OR REPLACE TRIGGER "enforce_message_immutability" BEFORE DELETE OR UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_message_mutation"();



COMMENT ON TRIGGER "enforce_message_immutability" ON "public"."messages" IS 'Garante a imutabilidade total do log. Qualquer UPDATE ou DELETE lança uma exceção, protegendo a integridade do histórico de consultorias.';



CREATE OR REPLACE TRIGGER "payments_set_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credits"
    ADD CONSTRAINT "credits_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credits"
    ADD CONSTRAINT "credits_used_for_consultation_id_fkey" FOREIGN KEY ("used_for_consultation_id") REFERENCES "public"."consultations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credits"
    ADD CONSTRAINT "credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin gerencia agenda_blocks" ON "public"."agenda_blocks" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Admin gerencia agenda_config" ON "public"."agenda_config" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Admin vê todos os créditos" ON "public"."credits" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Cliente vê seus créditos" ON "public"."credits" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Cliente vê seus payments" ON "public"."payments" FOR SELECT USING (("auth"."uid"() = ( SELECT "consultations"."user_id"
   FROM "public"."consultations"
  WHERE ("consultations"."id" = "payments"."consultation_id"))));



CREATE POLICY "Clientes leem agenda_blocks" ON "public"."agenda_blocks" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Clientes leem agenda_config" ON "public"."agenda_config" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Leitura publica de promocoes" ON "public"."promocoes" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Middleware pode ler user_roles" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Service role gerencia créditos" ON "public"."credits" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role gerencia payments" ON "public"."payments" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "admin_all_consultations" ON "public"."consultations" USING ((("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text"));



CREATE POLICY "admin_all_messages" ON "public"."messages" USING ((("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text"));



CREATE POLICY "admin_all_payments" ON "public"."payments" USING ((("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text"));



CREATE POLICY "admin_all_photos" ON "public"."photos" USING ((("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text"));



CREATE POLICY "admin_all_profiles" ON "public"."profiles" USING ((("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text"));



CREATE POLICY "admin_select_all_consultations" ON "public"."consultations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"text")))));



CREATE POLICY "admin_select_all_photos" ON "public"."photos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"text")))));



CREATE POLICY "admin_select_all_profiles" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"text")))));



CREATE POLICY "admin_update_all_consultations" ON "public"."consultations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"text")))));



CREATE POLICY "admin_update_all_photos" ON "public"."photos" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"text")))));



ALTER TABLE "public"."agenda_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agenda_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cliente_insert_own_consultation" ON "public"."consultations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "cliente_insert_own_messages" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND ("consultation_id" IN ( SELECT "consultations"."id"
   FROM "public"."consultations"
  WHERE ("consultations"."user_id" = "auth"."uid"())))));



CREATE POLICY "cliente_insert_own_photos" ON "public"."photos" FOR INSERT WITH CHECK (("consultation_id" IN ( SELECT "consultations"."id"
   FROM "public"."consultations"
  WHERE ("consultations"."user_id" = "auth"."uid"()))));



CREATE POLICY "cliente_insert_own_profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "cliente_select_own_consultations" ON "public"."consultations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "cliente_select_own_messages" ON "public"."messages" FOR SELECT USING (("consultation_id" IN ( SELECT "consultations"."id"
   FROM "public"."consultations"
  WHERE ("consultations"."user_id" = "auth"."uid"()))));



CREATE POLICY "cliente_select_own_payments" ON "public"."payments" FOR SELECT USING (("consultation_id" IN ( SELECT "consultations"."id"
   FROM "public"."consultations"
  WHERE ("consultations"."user_id" = "auth"."uid"()))));



CREATE POLICY "cliente_select_own_photos" ON "public"."photos" FOR SELECT USING (("consultation_id" IN ( SELECT "consultations"."id"
   FROM "public"."consultations"
  WHERE ("consultations"."user_id" = "auth"."uid"()))));



CREATE POLICY "cliente_select_own_profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "cliente_update_own_profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."consultations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_insert_public" ON "public"."leads" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "leads_select_authenticated" ON "public"."leads" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "only_service_role_manages_roles" ON "public"."user_roles" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promocoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "realtime_messages" ON "public"."messages" FOR SELECT TO "authenticated" USING ((("consultation_id" IN ( SELECT "consultations"."id"
   FROM "public"."consultations"
  WHERE ("consultations"."user_id" = "auth"."uid"()))) OR (("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text")));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";



GRANT ALL ON FUNCTION "public"."close_chat_room"("p_consultation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."close_chat_room"("p_consultation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_chat_room"("p_consultation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_payment"("p_gateway_id" character varying, "p_status" "public"."payment_status_enum") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_payment"("p_gateway_id" character varying, "p_status" "public"."payment_status_enum") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_payment"("p_gateway_id" character varying, "p_status" "public"."payment_status_enum") TO "service_role";



REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "supabase_auth_admin";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."incrementar_usadas"("promo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."incrementar_usadas"("promo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."incrementar_usadas"("promo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_message_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_message_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_message_mutation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."agenda_blocks" TO "anon";
GRANT ALL ON TABLE "public"."agenda_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."agenda_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."agenda_config" TO "anon";
GRANT ALL ON TABLE "public"."agenda_config" TO "authenticated";
GRANT ALL ON TABLE "public"."agenda_config" TO "service_role";



GRANT ALL ON TABLE "public"."consultations" TO "anon";
GRANT ALL ON TABLE "public"."consultations" TO "authenticated";
GRANT ALL ON TABLE "public"."consultations" TO "service_role";



GRANT ALL ON TABLE "public"."credits" TO "anon";
GRANT ALL ON TABLE "public"."credits" TO "authenticated";
GRANT ALL ON TABLE "public"."credits" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."photos" TO "anon";
GRANT ALL ON TABLE "public"."photos" TO "authenticated";
GRANT ALL ON TABLE "public"."photos" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."promocoes" TO "anon";
GRANT ALL ON TABLE "public"."promocoes" TO "authenticated";
GRANT ALL ON TABLE "public"."promocoes" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";
GRANT SELECT ON TABLE "public"."user_roles" TO "supabase_auth_admin";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







