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
  public: {
    Tables: {
      configuracion_panel: {
        Row: {
          columna_pagos: string | null
          id: string
          lluvia_suspension: string
          puertos_10vs10: boolean
          suspension_extra_1: string | null
          suspension_extra_2: string | null
          updated_at: string
        }
        Insert: {
          columna_pagos?: string | null
          id?: string
          lluvia_suspension?: string
          puertos_10vs10?: boolean
          suspension_extra_1?: string | null
          suspension_extra_2?: string | null
          updated_at?: string
        }
        Update: {
          columna_pagos?: string | null
          id?: string
          lluvia_suspension?: string
          puertos_10vs10?: boolean
          suspension_extra_1?: string | null
          suspension_extra_2?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      convocatorias: {
        Row: {
          created_at: string
          estado: string
          fecha: string
          id: string
          sedes_canceladas: string[]
          suspension_lluvia: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: string
          fecha: string
          id?: string
          sedes_canceladas?: string[]
          suspension_lluvia?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: string
          fecha?: string
          id?: string
          sedes_canceladas?: string[]
          suspension_lluvia?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      equipos_asignados: {
        Row: {
          asistio: boolean | null
          calificacion: number | null
          convocatoria_id: string
          created_at: string
          id: string
          jugador_id: string
          orden_convocatoria: number
          sede_id: string
          tipo_asignacion: string
        }
        Insert: {
          asistio?: boolean | null
          calificacion?: number | null
          convocatoria_id: string
          created_at?: string
          id?: string
          jugador_id: string
          orden_convocatoria?: number
          sede_id: string
          tipo_asignacion?: string
        }
        Update: {
          asistio?: boolean | null
          calificacion?: number | null
          convocatoria_id?: string
          created_at?: string
          id?: string
          jugador_id?: string
          orden_convocatoria?: number
          sede_id?: string
          tipo_asignacion?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipos_asignados_convocatoria_id_fkey"
            columns: ["convocatoria_id"]
            isOneToOne: false
            referencedRelation: "convocatorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipos_asignados_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_asistencias: {
        Row: {
          asistio: boolean
          convocatoria_id: string
          estado: string
          id: string
          jugador_id: string
          motivo: string | null
          sede_id: string
          timestamp: string
        }
        Insert: {
          asistio?: boolean
          convocatoria_id: string
          estado: string
          id?: string
          jugador_id: string
          motivo?: string | null
          sede_id: string
          timestamp?: string
        }
        Update: {
          asistio?: boolean
          convocatoria_id?: string
          estado?: string
          id?: string
          jugador_id?: string
          motivo?: string | null
          sede_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "historial_asistencias_convocatoria_id_fkey"
            columns: ["convocatoria_id"]
            isOneToOne: false
            referencedRelation: "convocatorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_asistencias_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
        ]
      }
      inscripciones: {
        Row: {
          convocatoria_id: string
          estado: string
          flexible: boolean
          id: string
          juega_con_lluvia: boolean
          jugador_id: string
          motivo_no_asignacion: string | null
          sede_preferida: string
          timestamp_inscripcion: string
        }
        Insert: {
          convocatoria_id: string
          estado?: string
          flexible?: boolean
          id?: string
          juega_con_lluvia?: boolean
          jugador_id: string
          motivo_no_asignacion?: string | null
          sede_preferida?: string
          timestamp_inscripcion?: string
        }
        Update: {
          convocatoria_id?: string
          estado?: string
          flexible?: boolean
          id?: string
          juega_con_lluvia?: boolean
          jugador_id?: string
          motivo_no_asignacion?: string | null
          sede_preferida?: string
          timestamp_inscripcion?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscripciones_convocatoria_id_fkey"
            columns: ["convocatoria_id"]
            isOneToOne: false
            referencedRelation: "convocatorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripciones_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
        ]
      }
      jugadores: {
        Row: {
          activo: boolean
          apodo: string
          asistencias_totales: number
          bajas_aviso: number
          email: string
          es_vip: boolean
          estado_pago: string
          fecha_registro: string
          flexible: boolean
          id: string
          juega_con_lluvia: boolean
          no_apariciones: number
          nombre: string
          puntaje_historico: number
          sede_preferida: string
        }
        Insert: {
          activo?: boolean
          apodo?: string
          asistencias_totales?: number
          bajas_aviso?: number
          email: string
          es_vip?: boolean
          estado_pago?: string
          fecha_registro?: string
          flexible?: boolean
          id?: string
          juega_con_lluvia?: boolean
          no_apariciones?: number
          nombre: string
          puntaje_historico?: number
          sede_preferida?: string
        }
        Update: {
          activo?: boolean
          apodo?: string
          asistencias_totales?: number
          bajas_aviso?: number
          email?: string
          es_vip?: boolean
          estado_pago?: string
          fecha_registro?: string
          flexible?: boolean
          id?: string
          juega_con_lluvia?: boolean
          no_apariciones?: number
          nombre?: string
          puntaje_historico?: number
          sede_preferida?: string
        }
        Relationships: []
      }
      sedes: {
        Row: {
          activa: boolean
          capacidad: number
          horario: string
          id: string
          nombre: string
          ubicacion: string
        }
        Insert: {
          activa?: boolean
          capacidad?: number
          horario?: string
          id: string
          nombre: string
          ubicacion?: string
        }
        Update: {
          activa?: boolean
          capacidad?: number
          horario?: string
          id?: string
          nombre?: string
          ubicacion?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
