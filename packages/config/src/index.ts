export const config = {
  models: {
    scoring: "claude-haiku-4-5",
    generation: "claude-sonnet-4-5",
  },
  scoring: {
    weights: {
      seo_title: 30,
      seo_description: 25,
      handle: 15,
      description: 20,
      variants: 10,
    },
  },
  tiendanube: {
    api_base: "https://api.tiendanube.com/v1",
    auth_base: "https://www.tiendanube.com/apps",
  },
} as const;

export type Config = typeof config;
