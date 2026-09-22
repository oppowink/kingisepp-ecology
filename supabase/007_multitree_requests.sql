-- Одна точка наблюдения включает от двух до четырёх деревьев.
-- Выполнить после 006_training_landmarks_and_integrity.sql.

alter table public.monitoring_requests
  add column if not exists trees jsonb not null default '[]'::jsonb;

-- Старые заявки сохраняются и остаются читаемыми в новом кабинете.
update public.monitoring_requests
set trees = jsonb_build_array(jsonb_build_object(
  'treePhoto', tree_photo,
  'files', files,
  'treeCondition', tree_condition,
  'trunkDiameterCm', trunk_diameter_cm,
  'treeHeightEstimateM', tree_height_estimate_m,
  'treeDamageNotes', tree_damage_notes
))
where (trees is null or trees = '[]'::jsonb) and tree_photo is not null;

comment on column public.monitoring_requests.trees is
  'Деревья внутри точки с обзорной фотографией, паспортом и файлами листьев каждого дерева';
