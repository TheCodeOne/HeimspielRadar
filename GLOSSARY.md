# HeimspielRadar Domain Glossary

HeimspielRadar (Sundayleague) discovers and visualizes amateur sports matches based on geographical proximity and schedule dates.

## Competitions & Teams

**Heimspiel (Home Match)**:
A scheduled league match hosted by a specific home team at its designated venue.
_Avoid_: Event, game session, fixture

**Match**:
A competitive sporting contest between exactly one home team and one guest team within a league.
_Avoid_: Encounter, duel

**Team**:
An athletic squad affiliated with a club that participates in one or more competitions.
_Avoid_: Group, roster, party

**Club (Verein)**:
The registered sports organization that fields one or more teams across different divisions.
_Avoid_: Organization, franchise

**League (Spielklasse / Staffel)**:
A structured division of teams competing against each other over a defined season.
_Avoid_: Tournament, pool, division

## Geography & Venues

**Venue (Sporthalle / Spielfeld)**:
The physical sports facility with a verified street address and geographic coordinates where matches take place.
_Avoid_: Stadium, arena, pitch, court

**Radius**:
The circular geographic search boundary in kilometers measured from the user's reference point.
_Avoid_: Distance limit, range, perimeter

**Coordinates**:
The latitude and longitude pair identifying a venue on the map.
_Avoid_: Location string, GPS tag

## UI & Architecture

**Map Engine**:
The core interactive map renderer responsible for displaying vector tiles, markers, and search overlays. Following ADR-0003, HeimspielRadar consolidates on MapLibre GL JS with OpenFreeMap vector tiles.
_Avoid_: Map wrapper, test map, map fork

**useMapViewModel**:
The deep module hook encapsulating coordinate validation, venue deduplication, Mercator clustering, search radius GeoJSON generation, and bounding-box calculations for the map view adapter.
