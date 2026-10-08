import { ApiError } from '../errors'

export function routeParameters(path: string) {
  return path
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1))
}

export function validRoute(path: string) {
  if (!/^\/[a-zA-Z0-9/_:-]+$/.test(path)) return false
  const names = routeParameters(path)
  return (
    new Set(names).size === names.length &&
    path
      .split('/')
      .every(
        (segment) =>
          !segment.includes(':') ||
          (/^:[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(segment) &&
            !['__proto__', 'prototype', 'constructor'].includes(
              segment.slice(1),
            )),
      )
  )
}

function safeValue(value: string) {
  if (
    !value ||
    /[/\\\u0000-\u001f\u007f]/.test(value) ||
    value === '.' ||
    value === '..'
  )
    throw new ApiError(400, 'Invalid route parameter value')
  return value
}

export function concreteRoute(
  path: string,
  params: Record<string, string> = {},
) {
  const names = routeParameters(path)
  if (
    Object.keys(params).length !== names.length ||
    names.some((name) => !Object.hasOwn(params, name))
  )
    throw new ApiError(
      400,
      'Provide exactly the route parameters required by this API',
    )
  return path
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment
      const value = params[segment.slice(1)]
      if (typeof value !== 'string')
        throw new ApiError(400, 'Route parameters must be text')
      try {
        return encodeURIComponent(safeValue(value))
      } catch {
        throw new ApiError(400, 'Invalid route parameter value')
      }
    })
    .join('/')
}

export function decodedRoute(path: string) {
  return path.split('/').map((segment) => {
    if (!segment) return ''
    try {
      return safeValue(decodeURIComponent(segment))
    } catch {
      throw new ApiError(400, 'Invalid route encoding or segment')
    }
  })
}

export function matchRoute(template: string, segments: string[]) {
  const parts = template.split('/')
  if (parts.length !== segments.length) return null
  const params: Record<string, string> = {}
  for (let index = 0; index < parts.length; index++) {
    if (parts[index].startsWith(':')) {
      if (!segments[index]) return null
      params[parts[index].slice(1)] = segments[index]
    } else if (parts[index] !== segments[index]) return null
  }
  return params
}

export function overlappingRoutes(left: string, right: string) {
  const parts = left.split('/')
  const other = right.split('/')
  return (
    parts.length === other.length &&
    parts.every(
      (part, index) =>
        part === other[index] ||
        (part.startsWith(':') && other[index] !== '') ||
        (other[index].startsWith(':') && part !== ''),
    )
  )
}
