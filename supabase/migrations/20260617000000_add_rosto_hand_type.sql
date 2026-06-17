-- Adiciona 'rosto' ao enum hand_type_enum para suportar foto frontal de rosto
-- (migração de fotos de mão para foto de rosto na triagem — 17/06/2026)
ALTER TYPE "public"."hand_type_enum" ADD VALUE IF NOT EXISTS 'rosto';
