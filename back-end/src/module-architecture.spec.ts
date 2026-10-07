import { Test } from '@nestjs/testing';
import { ModulesContainer } from '@nestjs/core';
import { MODULE_METADATA } from '@nestjs/common/constants';
import type { DynamicModule, Type } from '@nestjs/common';
import { AppModule } from './app.module';

type Import = Type<unknown> | DynamicModule;
function metadata(mod: Import) {
  const type = typeof mod === 'function' ? mod : mod.module;
  const imports: Import[] = [
    ...((Reflect.getMetadata(MODULE_METADATA.IMPORTS, type) as
      | Import[]
      | undefined) || []),
    ...(typeof mod === 'function'
      ? []
      : (mod.imports as Import[] | undefined) || []),
  ];
  return { type, imports };
}
/** Dependency direction and singleton stores are runtime invariants, not naming preferences. */
describe('Backend module boundaries', () => {
  it('has no cycles, controller-bearing core modules, or workflow imports in data modules', () => {
    const done = new Set<Type<unknown>>();
    function visit(mod: Import, path: Type<unknown>[]) {
      const { type, imports } = metadata(mod);
      if (path.includes(type))
        throw new Error(
          `Module cycle: ${[...path, type].map((item) => item.name).join(' → ')}`,
        );
      if (done.has(type)) return;
      if (type.name.endsWith('DataModule')) expect(imports).toEqual([]);
      if (type.name.endsWith('CoreModule')) {
        expect(
          Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, type) || [],
        ).toEqual([]);
        for (const dependency of imports)
          expect(
            Reflect.getMetadata(
              MODULE_METADATA.CONTROLLERS,
              metadata(dependency).type,
            ) || [],
          ).toEqual([]);
      }
      imports.forEach((dependency) => visit(dependency, [...path, type]));
      done.add(type);
    }
    visit(AppModule, []);
  });
  it('registers each repository exactly once across all HTTP and workflow modules', async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    try {
      const registrations = new Map<string, number>();
      for (const module of fixture.get(ModulesContainer).values()) {
        for (const [token, provider] of module.providers) {
          if (
            typeof token === 'function' &&
            token.name.endsWith('Repository') &&
            !provider.isAlias
          )
            registrations.set(
              token.name,
              (registrations.get(token.name) || 0) + 1,
            );
        }
      }
      expect(registrations.size).toBe(14);
      for (const [name, count] of registrations)
        expect({ name, count }).toEqual({ name, count: 1 });
    } finally {
      await fixture.close();
    }
  });
});
