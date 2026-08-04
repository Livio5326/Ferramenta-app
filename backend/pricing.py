"""Regole centralizzate per il prezzo di vendita IVA inclusa."""

from decimal import Decimal, ROUND_HALF_UP


VAT_RATE = Decimal("0.22")
DEFAULT_MARKUPS = {
    "upTo3": 70.0,
    "upTo6": 60.0,
    "upTo18": 50.0,
    "upTo30": 40.0,
    "over30": 30.0,
}


def markup_rate(purchase_price: float, markups: dict | None = None) -> Decimal:
    price = Decimal(str(purchase_price))
    values = {**DEFAULT_MARKUPS, **(markups or {})}
    if price <= Decimal("3.00"):
        return Decimal(str(values["upTo3"])) / 100
    if price <= Decimal("6.00"):
        return Decimal(str(values["upTo6"])) / 100
    if price <= Decimal("18.00"):
        return Decimal(str(values["upTo18"])) / 100
    if price <= Decimal("30.00"):
        return Decimal(str(values["upTo30"])) / 100
    return Decimal(str(values["over30"])) / 100


def calculate_sale_price(purchase_price: float, markups: dict | None = None) -> float:
    """Calcola il prezzo IVA inclusa, arrotondato a 10 centesimi."""
    price = Decimal(str(purchase_price or 0))
    if price <= 0:
        return 0.0
    gross = price * (Decimal("1") + markup_rate(float(price), markups)) * (
        Decimal("1") + VAT_RATE
    )
    return float(gross.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
