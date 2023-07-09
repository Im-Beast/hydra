# 🌐 Hydra

> Keep in mind that Hydra is still under heavy development and things might drastically change!

<img src="./docs/logo.svg" align="right" width="250" height="250" alt="Hydra logo, three headed Deno mascot" />

Web framework for Deno which strives to balance performance and feature richness.

### 🔩 Features

- 💖 Ease of use
- 🚀 [Really, really high performancce](https://github.com/Im-Beast/http_benchmarks)
- 📁 Built-in file-server
- 🌍 Fully supported URL Pattern API
- 🛡️ Type safety
  - 📄 Type-first
  - 🥇 First framework<sup>1</sup> to have fully type-safe URL Patterns!
  - 🪽 Middlewares can switch response type on the fly
- 🖇️ No dependencies

<sup>1 – Hydra is the first web framework to support automatic typing of non-capturing and regex groups</sup>

### 🥅 Goals

These goals are pinpoints that need to be achieved **before 1.0**!

- [x] ⚖️ Strike the right balance Developer Experience and Speed
  - [x] 🧑‍💼 Don't compromise on DX just to make things faster
- [ ] 🧪 Have 100% test coverage, make sure things are stable
- [ ] 📝 Have great documentation
- [ ] 🔋 Have all batteries included
  - [ ] Create first-party middlewares to make development a walk in the park

## Get started

> Remember to change `VERSION` to latest version of Hydra`

```ts
import { Hydra } from "https://deno.land/x/hydra@VERSION/mod.ts";

const app = new Hydra("127.0.0.1", 8000);

app.get("/", () => {
  return "Hello world!";
});

await app.serve();
```

## 🤝 Contributing

**Hydra** is open for any contributions.
<br /> If you feel like you can enhance this project - please open an issue and/or pull request.
<br /> Code should be well document and easy to follow what's going on.

This project follows [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) spec.
<br /> If your pull request's code can be hard to understand, please add comments to it.

## 📝 Licensing

This project is available under **MIT** License conditions.
