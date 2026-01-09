export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface AppSettingsTable {
    Row: {
        key: string
        value: string // Treated as string in the application logic despite being JSONB
        description: string | null
        updated_at: string
        updated_by: string | null
    }
    Insert: {
        key: string
        value: string | Json
        description?: string | null
        updated_at?: string
        updated_by?: string | null
    }
    Update: {
        key?: string
        value?: string | Json
        description?: string | null
        updated_at?: string
        updated_by?: string | null
    }
}

export interface UserWaterDepositsTable {
    Row: {
        id: string
        user_id: string
        bottles_owned: number
        total_deposit_paid: number
        created_at: string
        updated_at: string
    }
    Insert: {
        id?: string
        user_id: string
        bottles_owned?: number
        total_deposit_paid?: number
        created_at?: string
        updated_at?: string
    }
    Update: {
        id?: string
        user_id?: string
        bottles_owned?: number
        total_deposit_paid?: number
        created_at?: string
        updated_at?: string
    }
}

export interface WaterDepositTransactionsTable {
    Row: {
        id: string
        user_id: string
        transaction_type: 'purchase' | 'refund'
        bottles_count: number
        amount: number
        payment_status: 'pending' | 'completed' | 'failed' | 'refunded'
        order_id: string | null
        notes: string | null
        created_at: string
    }
    Insert: {
        id?: string
        user_id: string
        transaction_type: 'purchase' | 'refund'
        bottles_count: number
        amount: number
        payment_status?: 'pending' | 'completed' | 'failed' | 'refunded'
        order_id?: string | null
        notes?: string | null
        created_at?: string
    }
    Update: {
        id?: string
        user_id?: string
        transaction_type?: 'purchase' | 'refund'
        bottles_count?: number
        amount?: number
        payment_status?: 'pending' | 'completed' | 'failed' | 'refunded'
        order_id?: string | null
        notes?: string | null
        created_at?: string
    }
}

export interface ExtendedDatabase {
    public: {
        Tables: {
            app_settings: AppSettingsTable
            user_water_deposits: UserWaterDepositsTable
            water_deposit_transactions: WaterDepositTransactionsTable
            // Include existing tables loosely if needed, or intersection handled at client
            products: {
                Row: {
                    id: string
                    name: string
                    price: number
                    // Add other fields as needed for specific queries if strict mode requires it
                }
            }
        }
    }
}
