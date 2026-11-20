# Parameter Matrix

| Parameter | Options |
|-----------|---------|
| length | numeric ft (6-40) |
| width | numeric ft (6-40) |
| wallHeight | one of 6, 7, 8 |
| structureType | storage_shed (shown as Storage Shed / Garage), greenhouse, well_pump, open_loafing (shown as Loafing Shed / 3-Sided Shelter), carport. Legacy portable_garage inputs remain accepted for old quote records. |
| color | one of Black, Charcoal, Pewter, Gray, Alamo, Brilliant, Forest, Hunter, Colony, Crimson, Rustic, Burgundy, Gallery, Ocean, Ivory, Light Stone, Desert, Taupe, Burnished Slate, Brown, Tan, Copper Metallic, Galvalume |
| roofStyle | gabled, barn, lean-to |
| siding | metal |
| door | single_shed, double_shed, garage_roll_up, house |
| windowPackage | 24x36 |
| deliveryAddress | optional build address or city/state/ZIP from Use Current Location in the Build Location field |
| deliveryRadius | legacy request compatibility only (0-250 accepted); server-normalized to 0, never authoritative pricing input, and delivery remains pending verification |
| discountCode | optional string |

Location access is requested from a customer-facing prompt on the Build Location & Contact
step before the browser permission dialog appears. Customers can skip it and still
enter a build address or ZIP manually. The browser does not ask for delivery mileage;
staff verifies delivery, travel, and site costs before the final quote.
