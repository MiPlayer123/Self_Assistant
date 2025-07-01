

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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_daily_usage_limit"("user_uuid" "uuid", "usage_type" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_usage integer;
  user_tier text;
  daily_limit integer;
BEGIN
  -- Get user's subscription tier from profiles
  SELECT subscription_tier INTO user_tier
  FROM profiles
  WHERE id = user_uuid AND subscription_status = 'active';
  
  -- Set limits based on tier
  CASE user_tier
    WHEN 'free' THEN
      CASE usage_type
        WHEN 'chat_messages' THEN daily_limit := 5;
        ELSE daily_limit := 0;
      END CASE;
    WHEN 'pro' THEN daily_limit := -1; -- Unlimited
    WHEN 'enterprise' THEN daily_limit := -1; -- Unlimited
    ELSE daily_limit := 0;
  END CASE;
  
  -- If unlimited, return true
  IF daily_limit = -1 THEN
    RETURN true;
  END IF;
  
  -- Get current usage for today
  SELECT COALESCE(
    CASE usage_type
      WHEN 'chat_messages' THEN chat_messages_count
      WHEN 'voice_transcriptions' THEN voice_transcriptions_count
      WHEN 'screen_context' THEN screen_context_requests
      ELSE 0
    END, 0
  ) INTO current_usage
  FROM usage_tracking
  WHERE user_id = user_uuid AND date = CURRENT_DATE;
  
  RETURN current_usage < daily_limit;
END;
$$;


ALTER FUNCTION "public"."check_daily_usage_limit"("user_uuid" "uuid", "usage_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_email text;
  user_name text;
BEGIN
  -- Extract email and name safely
  user_email := COALESCE(NEW.email, '');
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(user_email, '@', 1));
  
  -- Only proceed if we have a valid email
  IF user_email != '' THEN
    -- Insert profile with default free subscription
    BEGIN
      INSERT INTO public.profiles (
        id, 
        email, 
        full_name, 
        subscription_tier, 
        subscription_status,
        created_at, 
        updated_at
      )
      VALUES (
        NEW.id,
        user_email,
        user_name,
        'free',
        'active',
        now(),
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the user creation
      RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_subscription_webhook"("stripe_subscription_id_param" "text", "user_id_param" "uuid", "tier_param" "text", "status_param" "text", "stripe_customer_id_param" "text" DEFAULT NULL::"text", "current_period_start_param" timestamp with time zone DEFAULT NULL::timestamp with time zone, "current_period_end_param" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update profile with subscription information
  UPDATE profiles 
  SET 
    subscription_tier = tier_param,
    subscription_status = status_param,
    stripe_subscription_id = stripe_subscription_id_param,
    stripe_customer_id = COALESCE(stripe_customer_id_param, stripe_customer_id),
    current_period_start = current_period_start_param,
    current_period_end = current_period_end_param,
    updated_at = now()
  WHERE id = user_id_param;
  
  -- If no rows were updated, the user doesn't exist
  IF NOT FOUND THEN
    RAISE WARNING 'User % not found when updating subscription', user_id_param;
  END IF;
END;
$$;


ALTER FUNCTION "public"."handle_subscription_webhook"("stripe_subscription_id_param" "text", "user_id_param" "uuid", "tier_param" "text", "status_param" "text", "stripe_customer_id_param" "text", "current_period_start_param" timestamp with time zone, "current_period_end_param" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_usage"("user_uuid" "uuid", "usage_type" "text", "increment_by" integer DEFAULT 1) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO usage_tracking (user_id, date, chat_messages_count, voice_transcriptions_count, screen_context_requests)
  VALUES (
    user_uuid,
    CURRENT_DATE,
    CASE WHEN usage_type = 'chat_messages' THEN increment_by ELSE 0 END,
    CASE WHEN usage_type = 'voice_transcriptions' THEN increment_by ELSE 0 END,
    CASE WHEN usage_type = 'screen_context' THEN increment_by ELSE 0 END
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    chat_messages_count = usage_tracking.chat_messages_count + 
      CASE WHEN usage_type = 'chat_messages' THEN increment_by ELSE 0 END,
    voice_transcriptions_count = usage_tracking.voice_transcriptions_count + 
      CASE WHEN usage_type = 'voice_transcriptions' THEN increment_by ELSE 0 END,
    screen_context_requests = usage_tracking.screen_context_requests + 
      CASE WHEN usage_type = 'screen_context' THEN increment_by ELSE 0 END,
    updated_at = now();
END;
$$;


ALTER FUNCTION "public"."increment_usage"("user_uuid" "uuid", "usage_type" "text", "increment_by" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "context" "text",
    "stripe_subscription_id" "text",
    "stripe_customer_id" "text",
    "subscription_status" "text" DEFAULT 'active'::"text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    CONSTRAINT "profiles_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['active'::"text", 'cancelled'::"text", 'expired'::"text", 'past_due'::"text"]))),
    CONSTRAINT "profiles_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['free'::"text", 'pro'::"text", 'enterprise'::"text"])))
);

ALTER TABLE ONLY "public"."profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE,
    "chat_messages_count" integer DEFAULT 0,
    "voice_transcriptions_count" integer DEFAULT 0,
    "screen_context_requests" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."usage_tracking" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."usage_tracking" OWNER TO "postgres";


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_tracking"
    ADD CONSTRAINT "usage_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_tracking"
    ADD CONSTRAINT "usage_tracking_user_id_date_key" UNIQUE ("user_id", "date");



CREATE INDEX "idx_profiles_stripe_customer_id" ON "public"."profiles" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_profiles_stripe_subscription_id" ON "public"."profiles" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_profiles_subscription_status" ON "public"."profiles" USING "btree" ("subscription_status");



CREATE INDEX "idx_profiles_subscription_tier" ON "public"."profiles" USING "btree" ("subscription_tier");



CREATE INDEX "idx_usage_tracking_user_date" ON "public"."usage_tracking" USING "btree" ("user_id", "date");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_tracking"
    ADD CONSTRAINT "usage_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Service role can manage all profiles" ON "public"."profiles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage all usage" ON "public"."usage_tracking" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own usage" ON "public"."usage_tracking" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can read own usage" ON "public"."usage_tracking" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own usage" ON "public"."usage_tracking" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usage_tracking" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."check_daily_usage_limit"("user_uuid" "uuid", "usage_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_daily_usage_limit"("user_uuid" "uuid", "usage_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_daily_usage_limit"("user_uuid" "uuid", "usage_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_subscription_webhook"("stripe_subscription_id_param" "text", "user_id_param" "uuid", "tier_param" "text", "status_param" "text", "stripe_customer_id_param" "text", "current_period_start_param" timestamp with time zone, "current_period_end_param" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."handle_subscription_webhook"("stripe_subscription_id_param" "text", "user_id_param" "uuid", "tier_param" "text", "status_param" "text", "stripe_customer_id_param" "text", "current_period_start_param" timestamp with time zone, "current_period_end_param" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_subscription_webhook"("stripe_subscription_id_param" "text", "user_id_param" "uuid", "tier_param" "text", "status_param" "text", "stripe_customer_id_param" "text", "current_period_start_param" timestamp with time zone, "current_period_end_param" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_usage"("user_uuid" "uuid", "usage_type" "text", "increment_by" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_usage"("user_uuid" "uuid", "usage_type" "text", "increment_by" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_usage"("user_uuid" "uuid", "usage_type" "text", "increment_by" integer) TO "service_role";


















GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."usage_tracking" TO "anon";
GRANT ALL ON TABLE "public"."usage_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_tracking" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
