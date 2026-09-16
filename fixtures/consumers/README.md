# Packed consumer fixtures

`pnpm check:packages` packs every public package, installs each tarball in a clean temporary consumer, imports every declared JavaScript entry point, and confirms undeclared/internal paths fail to resolve.
