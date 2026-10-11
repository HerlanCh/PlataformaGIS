declare const brand: unique symbol;

/** Tipo nominal: impide mezclar identificadores que comparten representación. */
export type Brand<T, Name extends string> = T & { readonly [brand]: Name };

export type ReportId = Brand<string, 'ReportId'>;
export type UserId = Brand<string, 'UserId'>;
export type CategoryCode = Brand<string, 'CategoryCode'>;
