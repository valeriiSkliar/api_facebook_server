export interface IScraperContext<Q, O, R> {
  query: Q;
  options: O;
  state: R;
}
