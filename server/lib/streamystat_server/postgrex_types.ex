Postgrex.Types.define(
  StreamystatServer.PostgrexTypes,
  Pgvector.extensions() ++ Ecto.Adapters.Postgres.extensions(),
  []
)
