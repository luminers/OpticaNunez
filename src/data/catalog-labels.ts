import type { Badge, Category, FaceWidth, FilterGroup, Gender, SortKey } from '@/types/catalog'

export const CATEGORY_INFO: Record<
  Category,
  { title: string; path: string; description: string; lenses: string; included: string[] }
> = {
  sol: {
    title: 'Anteojos de sol',
    path: '/anteojos-de-sol',
    lenses:
      'Vienen con cristales de sol con filtro UV400 y tratamiento antirrayas. Si los necesitás con graduación, elegila en el próximo paso y los armamos con tu receta.',
    included: ['Cristales de sol con filtro UV400', 'Estuche y paño de limpieza'],
    description:
      'Todos los modelos incluyen cristales con filtro UV400 y tratamiento antirrayas. ¿Los necesitás con graduación? Elegí el armazón y después cargá tu receta: los armamos en nuestro taller.',
  },
  recetados: {
    title: 'Anteojos recetados',
    path: '/anteojos-recetados',
    lenses:
      'En el próximo paso cargás tu receta y elegís los cristales: monofocales, multifocales, filtro de luz azul o fotocromáticos. Si no tenés receta, podés pedir un turno para el examen visual.',
    included: ['Estuche y paño de limpieza', 'Ajuste del armazón sin cargo en el local'],
    description:
      'El precio incluye el armazón. Después de elegirlo, cargá tu receta o pedí un turno para el examen visual y te recomendamos los cristales que mejor se adaptan a vos.',
  },
}

export const WIDTH_LABELS: Record<FaceWidth, string> = {
  angosto: 'Angosto',
  medio: 'Medio',
  ancho: 'Ancho',
}

export const GENDER_LABELS: Record<Gender, string> = {
  mujer: 'Mujer',
  hombre: 'Hombre',
  unisex: 'Todos',
}

// TODO: confirmar con la óptica qué beneficios ofrece realmente antes de publicar.
export const STORE_PERKS = ['Envío a todo el país', 'Retiro sin cargo en el local']

export const BADGE_LABELS: Record<Badge, string> = {
  nuevo: 'Nuevo',
  'mas-vendido': 'Más vendido',
}

export const FILTER_GROUPS: FilterGroup[] = [
  {
    key: 'destacado',
    label: 'Destacados',
    options: [
      { value: 'mas-vendido', label: 'Más vendidos' },
      { value: 'nuevo', label: 'Novedades' },
      { value: 'probador', label: 'Para probar con la cámara' },
    ],
  },
  {
    key: 'genero',
    label: 'Género',
    options: [
      { value: 'mujer', label: 'Mujer' },
      { value: 'hombre', label: 'Hombre' },
    ],
  },
  {
    key: 'forma',
    label: 'Forma',
    options: [
      { value: 'redondo', label: 'Redondo' },
      { value: 'cuadrado', label: 'Cuadrado' },
      { value: 'rectangular', label: 'Rectangular' },
      { value: 'aviador', label: 'Aviador' },
      { value: 'ojo-de-gato', label: 'Ojo de gato' },
    ],
  },
  {
    key: 'material',
    label: 'Material',
    options: [
      { value: 'acetato', label: 'Acetato' },
      { value: 'metal', label: 'Metal' },
    ],
  },
  {
    key: 'color',
    label: 'Color del armazón',
    options: [
      { value: 'negro', label: 'Negro' },
      { value: 'carey', label: 'Carey' },
      { value: 'transparente', label: 'Transparente' },
      { value: 'miel', label: 'Miel' },
      { value: 'dorado', label: 'Dorado' },
      { value: 'plateado', label: 'Plateado' },
      { value: 'verde', label: 'Verde' },
      { value: 'azul', label: 'Azul' },
      { value: 'rosa', label: 'Rosa' },
    ],
  },
  {
    key: 'ancho',
    label: 'Ancho de cara',
    options: [
      { value: 'angosto', label: 'Angosto' },
      { value: 'medio', label: 'Medio' },
      { value: 'ancho', label: 'Ancho' },
    ],
  },
]

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'destacados', label: 'Destacados' },
  { value: 'novedades', label: 'Novedades' },
  { value: 'precio-asc', label: 'Precio: menor a mayor' },
  { value: 'precio-desc', label: 'Precio: mayor a menor' },
]
