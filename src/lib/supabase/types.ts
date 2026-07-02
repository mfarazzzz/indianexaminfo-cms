/**
 * types.ts — Supabase generated DB types (hand-authored to match schema).
 * Run `supabase gen types typescript` to regenerate after schema changes.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      settings: {
        Row: {
          id: string;
          key: string;
          value: Json;
          group: string;
          label: string;
          description: string | null;
          is_sensitive: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["settings"]["Row"], "id" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["settings"]["Insert"]>;
      };
      categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          short_name: string | null;
          pillar: "sarkari-naukri" | "entrance-exam" | "board-university";
          parent_id: string | null;
          description: string | null;
          icon: string | null;
          color: string | null;
          order_index: number;
          is_active: boolean;
          exam_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["categories"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      exams: {
        Row: {
          id: string;
          slug: string;
          name: string;
          short_name: string;
          pillar: "sarkari-naukri" | "entrance-exam" | "board-university";
          category_id: string | null;
          subcategory_id: string | null;
          entity_type: "exam" | "board" | "university" | "recruitment" | null;
          conducting_body: string;
          official_website: string | null;
          status: "upcoming" | "active" | "registration-open" | "registration-closed" | "result-declared" | "completed" | "ongoing";
          has_admit_card: boolean;
          has_result: boolean;
          has_answer_key: boolean;
          has_syllabus: boolean;
          has_date_sheet: boolean;
          has_mock_test: boolean;
          has_previous_papers: boolean;
          has_study_material: boolean;
          has_application: boolean;
          has_notification: boolean;
          has_cutoff: boolean;
          vacancy: number | null;
          academic_year: string | null;
          semester: string | null;
          admission_to: string | null;
          eligibility: Json;
          application_fee: Json;
          selection_process: string[];
          syllabus_highlights: string[];
          important_dates: Json;
          seo_title: string | null;
          seo_description: string | null;
          faqs: Json;
          tags: string[];
          is_featured: boolean;
          search_keywords: string[];
          last_updated: string;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["exams"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["exams"]["Insert"]>;
      };
      content_posts: {
        Row: {
          id: string;
          slug: string;
          title: string;
          excerpt: string | null;
          content: string | null;
          exam_id: string | null;
          pillar: string;
          content_type: "notification" | "application" | "admit-card" | "date-sheet" | "syllabus" | "answer-key" | "result" | "cutoff" | "previous-papers" | "mock-test" | "study-material" | "books";
          quick_links: Json;
          important_dates: Json;
          featured_image: string | null;
          tags: string[];
          status: "draft" | "review" | "published" | "unpublished";
          is_featured: boolean;
          views: number;
          seo_title: string | null;
          seo_description: string | null;
          faqs: Json;
          published_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["content_posts"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["content_posts"]["Insert"]>;
      };
      blog_authors: {
        Row: {
          id: string;
          slug: string;
          name: string;
          designation: string | null;
          avatar: string | null;
          bio: string | null;
          total_posts: number;
          specialization: string[];
          social_links: Json;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["blog_authors"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["blog_authors"]["Insert"]>;
      };
      blog_posts: {
        Row: {
          id: string;
          slug: string;
          title: string;
          excerpt: string | null;
          content: string | null;
          section: "education-news" | "exam-prep" | "career-guidance" | "scholarship" | "study-abroad" | "edtech" | "student-life" | "opinion";
          post_type: "news" | "article" | "guide" | "listicle" | "opinion" | "interview" | "analysis" | "how-to" | null;
          author_id: string | null;
          featured_image: string | null;
          featured_image_caption: string | null;
          reading_time: number | null;
          word_count: number | null;
          views: number;
          shares: number;
          tags: string[];
          related_exam_slugs: string[];
          status: "draft" | "review" | "published" | "unpublished";
          is_featured: boolean;
          is_breaking: boolean;
          is_pinned: boolean;
          seo_title: string | null;
          seo_description: string | null;
          canonical_url: string | null;
          table_of_contents: Json;
          faqs: Json;
          published_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["blog_posts"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["blog_posts"]["Insert"]>;
      };
      pages: {
        Row: {
          id: string;
          slug: string;
          title: string;
          content: string | null;
          meta_title: string | null;
          meta_description: string | null;
          is_system: boolean;
          status: "draft" | "published";
          order_index: number;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["pages"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["pages"]["Insert"]>;
      };
      menus: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["menus"]["Row"], "id" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["menus"]["Insert"]>;
      };
      menu_items: {
        Row: {
          id: string;
          menu_id: string;
          parent_id: string | null;
          label: string;
          url: string | null;
          opens_in_new_tab: boolean;
          icon: string | null;
          badge: string | null;
          badge_color: string | null;
          order_index: number;
          is_active: boolean;
          exam_id: string | null;
          category_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["menu_items"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["menu_items"]["Insert"]>;
      };
      ad_zones: {
        Row: {
          id: string;
          slug: string;
          name: string;
          size: string;
          position: string;
          page_placement: string;
          description: string | null;
          is_active: boolean;
          fallback_html: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ad_zones"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["ad_zones"]["Insert"]>;
      };
      advertisers: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          company_name: string | null;
          email: string | null;
          phone: string | null;
          gst_number: string | null;
          contact_person: string | null;
          status: "active" | "inactive" | "suspended";
          total_spend: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["advertisers"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["advertisers"]["Insert"]>;
      };
      ad_campaigns: {
        Row: {
          id: string;
          advertiser_id: string;
          name: string;
          type: "display" | "sponsored-post" | "category-takeover" | null;
          status: "draft" | "pending-review" | "active" | "paused" | "completed" | "rejected";
          budget_total: number;
          budget_spent: number;
          budget_daily: number;
          billing_type: "CPM" | "CPC" | "flat-rate" | null;
          rate: number;
          impressions: number;
          clicks: number;
          ctr: number;
          start_date: string | null;
          end_date: string | null;
          target_zones: string[];
          target_categories: string[];
          notes: string | null;
          approved_by: string | null;
          approved_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["ad_campaigns"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["ad_campaigns"]["Insert"]>;
      };
      ad_creatives: {
        Row: {
          id: string;
          campaign_id: string;
          name: string;
          type: "image" | "html" | "text-link" | null;
          image_url: string | null;
          html_code: string | null;
          link_url: string;
          alt_text: string | null;
          size: string | null;
          is_active: boolean;
          impressions: number;
          clicks: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ad_creatives"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["ad_creatives"]["Insert"]>;
      };
      ad_reports: {
        Row: {
          id: string;
          campaign_id: string;
          date: string;
          impressions: number;
          clicks: number;
          ctr: number;
          spend: number;
          zone_id: string | null;
          page: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["ad_reports"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["ad_reports"]["Insert"]>;
      };
      media: {
        Row: {
          id: string;
          filename: string;
          original_name: string;
          url: string;
          thumbnail_url: string | null;
          mime_type: string;
          size: number;
          width: number | null;
          height: number | null;
          alt_text: string | null;
          folder: string;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["media"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["media"]["Insert"]>;
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          user_name: string;
          user_role: string;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          entity_name: string | null;
          details: Json;
          ip_address: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_log"]["Row"], "id" | "created_at">;
        Update: never;
      };
      user_profiles: {
        Row: {
          id: string;
          name: string;
          avatar: string | null;
          role_id: string | null;
          is_active: boolean;
          last_login: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_profiles"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
      };
      roles: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          is_system: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["roles"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
      };
      permissions: {
        Row: {
          id: string;
          slug: string;
          label: string;
          group: string;
        };
        Insert: Omit<Database["public"]["Tables"]["permissions"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["permissions"]["Insert"]>;
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
        };
        Insert: Database["public"]["Tables"]["role_permissions"]["Row"];
        Update: Partial<Database["public"]["Tables"]["role_permissions"]["Insert"]>;
      };
    };
    Functions: {
      current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
  };
}
