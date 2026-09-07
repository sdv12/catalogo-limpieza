export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string
          batch_id: string | null
          catalog_id: string
          changes: Json
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          product_id: string | null
          summary: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id: string
          batch_id?: string | null
          catalog_id: string
          changes?: Json
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          product_id?: string | null
          summary?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string
          batch_id?: string | null
          catalog_id?: string
          changes?: Json
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          product_id?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_members: {
        Row: {
          catalog_id: string
          created_at: string
          created_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          catalog_id: string
          created_at?: string
          created_by?: string | null
          role?: string
          user_id: string
        }
        Update: {
          catalog_id?: string
          created_at?: string
          created_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_members_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogs: {
        Row: {
          attributes: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          logo_path: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          catalog_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          catalog_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          catalog_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_catalog_id_fkey"
            columns: ["parent_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "catalog_id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          attributes: Json
          catalog_id: string
          city: string | null
          created_at: string
          created_by: string | null
          credit_limit: number
          deleted_at: string | null
          deleted_by: string | null
          doc_number: string | null
          doc_type: string | null
          email: string | null
          id: string
          is_active: boolean
          is_deleted: boolean
          name: string
          notes: string | null
          phone: string | null
          price_tier_id: string | null
          province: string | null
          tax_condition: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          attributes?: Json
          catalog_id: string
          city?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          deleted_at?: string | null
          deleted_by?: string | null
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          price_tier_id?: string | null
          province?: string | null
          tax_condition?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          attributes?: Json
          catalog_id?: string
          city?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          deleted_at?: string | null
          deleted_by?: string | null
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          price_tier_id?: string | null
          province?: string | null
          tax_condition?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_price_tier_id_catalog_id_fkey"
            columns: ["price_tier_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "price_tiers"
            referencedColumns: ["id", "catalog_id"]
          },
        ]
      }
      import_batches: {
        Row: {
          actor_id: string
          catalog_id: string
          completed_at: string | null
          created_at: string
          error_rows: number
          filename: string | null
          id: string
          kind: string
          ok_rows: number
          params: Json
          report: Json
          status: string
          total_rows: number
        }
        Insert: {
          actor_id: string
          catalog_id: string
          completed_at?: string | null
          created_at?: string
          error_rows?: number
          filename?: string | null
          id?: string
          kind: string
          ok_rows?: number
          params?: Json
          report?: Json
          status?: string
          total_rows?: number
        }
        Update: {
          actor_id?: string
          catalog_id?: string
          completed_at?: string | null
          created_at?: string
          error_rows?: number
          filename?: string | null
          id?: string
          kind?: string
          ok_rows?: number
          params?: Json
          report?: Json
          status?: string
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      price_tiers: {
        Row: {
          catalog_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          catalog_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          catalog_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_tiers_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          catalog_id: string
          category_id: string
          created_at: string
          is_primary: boolean
          product_id: string
        }
        Insert: {
          catalog_id: string
          category_id: string
          created_at?: string
          is_primary?: boolean
          product_id: string
        }
        Update: {
          catalog_id?: string
          category_id?: string
          created_at?: string
          is_primary?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_category_id_catalog_id_fkey"
            columns: ["category_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "catalog_id"]
          },
          {
            foreignKeyName: "product_categories_product_id_catalog_id_fkey"
            columns: ["product_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_view"
            referencedColumns: ["product_id", "catalog_id"]
          },
          {
            foreignKeyName: "product_categories_product_id_catalog_id_fkey"
            columns: ["product_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "catalog_id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string | null
          catalog_id: string
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          position: number
          product_id: string
          storage_path: string
          variant_id: string | null
        }
        Insert: {
          alt?: string | null
          catalog_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          position?: number
          product_id: string
          storage_path: string
          variant_id?: string | null
        }
        Update: {
          alt?: string | null
          catalog_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          position?: number
          product_id?: string
          storage_path?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_catalog_id_fkey"
            columns: ["product_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_view"
            referencedColumns: ["product_id", "catalog_id"]
          },
          {
            foreignKeyName: "product_images_product_id_catalog_id_fkey"
            columns: ["product_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "catalog_id"]
          },
          {
            foreignKeyName: "product_images_variant_id_catalog_id_fkey"
            columns: ["variant_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "catalog_id"]
          },
        ]
      }
      product_suppliers: {
        Row: {
          catalog_id: string
          cost: number | null
          created_at: string
          is_primary: boolean
          lead_time_days: number | null
          notes: string | null
          product_id: string
          supplier_id: string
          supplier_sku: string | null
          updated_at: string
        }
        Insert: {
          catalog_id: string
          cost?: number | null
          created_at?: string
          is_primary?: boolean
          lead_time_days?: number | null
          notes?: string | null
          product_id: string
          supplier_id: string
          supplier_sku?: string | null
          updated_at?: string
        }
        Update: {
          catalog_id?: string
          cost?: number | null
          created_at?: string
          is_primary?: boolean
          lead_time_days?: number | null
          notes?: string | null
          product_id?: string
          supplier_id?: string
          supplier_sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_suppliers_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_product_id_catalog_id_fkey"
            columns: ["product_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_view"
            referencedColumns: ["product_id", "catalog_id"]
          },
          {
            foreignKeyName: "product_suppliers_product_id_catalog_id_fkey"
            columns: ["product_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "catalog_id"]
          },
          {
            foreignKeyName: "product_suppliers_supplier_id_catalog_id_fkey"
            columns: ["supplier_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id", "catalog_id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json
          barcode: string | null
          catalog_id: string
          cost: number | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_deleted: boolean
          min_stock: number
          name: string
          position: number
          product_id: string
          size_unit: string | null
          size_value: number | null
          sku: string
          stock: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attributes?: Json
          barcode?: string | null
          catalog_id: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          min_stock?: number
          name: string
          position?: number
          product_id: string
          size_unit?: string | null
          size_value?: number | null
          sku: string
          stock?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attributes?: Json
          barcode?: string | null
          catalog_id?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          min_stock?: number
          name?: string
          position?: number
          product_id?: string
          size_unit?: string | null
          size_value?: number | null
          sku?: string
          stock?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_catalog_id_fkey"
            columns: ["product_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_view"
            referencedColumns: ["product_id", "catalog_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_catalog_id_fkey"
            columns: ["product_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "catalog_id"]
          },
        ]
      }
      products: {
        Row: {
          attributes: Json
          base_sku: string | null
          brand: string | null
          catalog_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          is_deleted: boolean
          name: string
          primary_category_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attributes?: Json
          base_sku?: string | null
          brand?: string | null
          catalog_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_deleted?: boolean
          name: string
          primary_category_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attributes?: Json
          base_sku?: string | null
          brand?: string | null
          catalog_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_deleted?: boolean
          name?: string
          primary_category_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_primary_category_id_catalog_id_fkey"
            columns: ["primary_category_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "catalog_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          is_superadmin: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          is_superadmin?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_superadmin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          catalog_id: string
          created_at: string
          created_by: string
          delta: number
          id: string
          new_stock: number
          note: string | null
          previous_stock: number
          reason: string
          variant_id: string
        }
        Insert: {
          batch_id?: string | null
          catalog_id: string
          created_at?: string
          created_by: string
          delta: number
          id?: string
          new_stock: number
          note?: string | null
          previous_stock: number
          reason: string
          variant_id: string
        }
        Update: {
          batch_id?: string | null
          catalog_id?: string
          created_at?: string
          created_by?: string
          delta?: number
          id?: string
          new_stock?: number
          note?: string | null
          previous_stock?: number
          reason?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_catalog_id_fkey"
            columns: ["variant_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "catalog_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          attributes: Json
          catalog_id: string
          city: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          doc_number: string | null
          doc_type: string | null
          email: string | null
          id: string
          is_active: boolean
          is_deleted: boolean
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          province: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          attributes?: Json
          catalog_id: string
          city?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          province?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          attributes?: Json
          catalog_id?: string
          city?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          province?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_prices: {
        Row: {
          catalog_id: string
          created_at: string
          currency: string
          id: string
          price: number
          price_tier_id: string
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          catalog_id: string
          created_at?: string
          currency?: string
          id?: string
          price: number
          price_tier_id: string
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          catalog_id?: string
          created_at?: string
          currency?: string
          id?: string
          price?: number
          price_tier_id?: string
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_prices_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_prices_price_tier_id_catalog_id_fkey"
            columns: ["price_tier_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "price_tiers"
            referencedColumns: ["id", "catalog_id"]
          },
          {
            foreignKeyName: "variant_prices_variant_id_catalog_id_fkey"
            columns: ["variant_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "catalog_id"]
          },
        ]
      }
    }
    Views: {
      catalog_view: {
        Row: {
          barcode: string | null
          base_sku: string | null
          brand: string | null
          catalog_id: string | null
          catalog_slug: string | null
          category_path: string | null
          description: string | null
          min_stock: number | null
          name: string | null
          prices: Json | null
          primary_category_id: string | null
          product_attributes: Json | null
          product_id: string | null
          size_unit: string | null
          size_value: number | null
          sku: string | null
          status: string | null
          stock: number | null
          stock_bajo: boolean | null
          variant_id: string | null
          variant_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_primary_category_id_catalog_id_fkey"
            columns: ["primary_category_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "catalog_id"]
          },
        ]
      }
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_delta: number
          p_note?: string
          p_reason: string
          p_variant_id: string
        }
        Returns: {
          attributes: Json
          barcode: string | null
          catalog_id: string
          cost: number | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_deleted: boolean
          min_stock: number
          name: string
          position: number
          product_id: string
          size_unit: string | null
          size_value: number | null
          sku: string
          stock: number
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "product_variants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ajustar_costo_proveedor: {
        Args: {
          p_catalog_id: string
          p_dry_run?: boolean
          p_mode?: string
          p_round?: boolean
          p_supplier_id: string
          p_value?: number
        }
        Returns: Json
      }
      can_edit_catalog: { Args: { cat: string }; Returns: boolean }
      can_manage_prices: { Args: { cat: string }; Returns: boolean }
      catalog_actors: {
        Args: { p_catalog_id: string }
        Returns: {
          actor_email: string
          actor_id: string
        }[]
      }
      catalog_stats: { Args: { p_catalog_id: string }; Returns: Json }
      category_path: { Args: { p_category_id: string }; Returns: string }
      duplicate_product: { Args: { p_product_id: string }; Returns: string }
      is_catalog_admin: { Args: { cat: string }; Returns: boolean }
      is_catalog_member: { Args: { cat: string }; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      propagar_costo_proveedor: {
        Args: {
          p_catalog_id: string
          p_dry_run?: boolean
          p_solo_sin_costo?: boolean
          p_supplier_id: string
        }
        Returns: Json
      }
      reprecio_por_filtro: {
        Args: {
          p_brand?: string
          p_catalog_id: string
          p_category_id?: string
          p_dry_run?: boolean
          p_mode?: string
          p_q?: string
          p_round?: boolean
          p_status?: string
          p_stock?: string
          p_supplier_id?: string
          p_tier_ids?: string[]
          p_value?: number
        }
        Returns: Json
      }
      run_import: {
        Args: {
          p_catalog_id: string
          p_dry_run?: boolean
          p_filename?: string
          p_rows: Json
        }
        Returns: Json
      }
      search_catalog: {
        Args: {
          p_catalog_slug: string
          p_limit?: number
          p_q?: string
          p_tier_code?: string
        }
        Returns: Json
      }
      search_products: {
        Args: {
          p_brand?: string
          p_catalog_id: string
          p_category_id?: string
          p_dir?: string
          p_include_deleted?: boolean
          p_limit?: number
          p_offset?: number
          p_q?: string
          p_sort?: string
          p_status?: string
          p_stock?: string
          p_supplier_id?: string
        }
        Returns: {
          base_sku: string
          brand: string
          category_name: string
          id: string
          is_deleted: boolean
          low_stock: boolean
          max_price: number
          min_cost: number
          min_price: number
          name: string
          primary_image: string
          status: string
          supplier_name: string
          total_count: number
          total_stock: number
          updated_at: string
          variant_count: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      storefront_meta: { Args: { p_catalog_slug: string }; Returns: Json }
      storefront_products: {
        Args: {
          p_catalog_slug: string
          p_category?: string
          p_limit?: number
          p_offset?: number
          p_q?: string
          p_sku?: string
        }
        Returns: Json
      }
      supplier_products: {
        Args: { p_catalog_id: string; p_supplier_id: string }
        Returns: {
          base_sku: string
          brand: string
          cost: number
          is_deleted: boolean
          is_primary: boolean
          min_price: number
          min_variant_cost: number
          name: string
          product_id: string
          status: string
          supplier_sku: string
          variant_count: number
        }[]
      }
      vincular_productos_proveedor: {
        Args: {
          p_catalog_id: string
          p_product_ids: string[]
          p_set_primary?: boolean
          p_supplier_id: string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
