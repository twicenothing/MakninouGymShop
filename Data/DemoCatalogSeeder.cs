using MakninouAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace MakninouAPI.Data;

public static class DemoCatalogSeeder
{
    private sealed record ProductSeed(string Name, string Description, int Price, int Stock,
        ProductCategory Category, bool ForWomen, long Sales);
    private sealed record PackSeed(string Name, string Description, int Price,
        params (string ProductName, int Quantity)[] Items);

    public static async Task SeedAsync(MakninouDBContext db, CancellationToken cancellationToken = default)
    {
        ProductSeed[] productSeeds =
        [
            new("Whey Gold Chocolat 1 kg", "Protéines pour accompagner la récupération après l'entraînement.", 8900, 24, ProductCategory.Proteine, false, 64),
            new("Whey Isolate Vanille 900 g", "Une formule légère riche en protéines, goût vanille.", 11200, 16, ProductCategory.Proteine, false, 48),
            new("Clear Whey Citron 500 g", "Une boisson protéinée fraîche au goût citron.", 7600, 13, ProductCategory.Proteine, false, 27),
            new("Créatine Monohydrate 300 g", "Créatine monohydrate simple à intégrer à votre routine.", 4200, 30, ProductCategory.Creatine, false, 58),
            new("Mass Gainer Vanille 3 kg", "Un apport généreux pour les objectifs de prise de masse.", 11900, 9, ProductCategory.MassGainer, false, 21),
            new("Pre-Workout Explosive", "Énergie et concentration avant les séances intenses.", 6500, 14, ProductCategory.PreWorkout, false, 35),
            new("Vitamine C 1000 mg", "Un essentiel quotidien en format 30 comprimés.", 1500, 40, ProductCategory.Vitamin, true, 43),
            new("Multivitamines Daily", "Vitamines et minéraux pour votre routine quotidienne.", 2900, 22, ProductCategory.Vitamin, true, 29),
            new("Barre Protéinée Chocolat", "Snack protéiné pratique, texture fondante au chocolat.", 450, 60, ProductCategory.Snack, false, 39),
            new("Boisson Électrolytes Citron", "Hydratation et électrolytes pour l'effort.", 350, 48, ProductCategory.Boisson, false, 18),
            new("Booster Tribulus", "Un complément pensé pour les programmes de performance.", 4800, 11, ProductCategory.Booster, false, 12),
            new("Thermo Fat Burner", "Formule thermogénique à intégrer à une alimentation équilibrée.", 5600, 12, ProductCategory.FatBurner, true, 17),
            new("BCAA 2:1:1 Fruits Rouges", "Acides aminés aromatisés pour accompagner vos entraînements.", 4900, 19, ProductCategory.AcidesAmine, false, 25),
            new("Collagène Marin Beauty", "Peptides de collagène marin, saveur neutre.", 5900, 15, ProductCategory.Collagene, true, 31)
        ];

        var products = await db.Products.ToDictionaryAsync(product => product.ProductName, cancellationToken);
        foreach (var seed in productSeeds)
        {
            if (products.ContainsKey(seed.Name)) continue;
            var product = new Product
            {
                ProductName = seed.Name,
                Description = seed.Description,
                ProductUnitPriceDZD = seed.Price,
                StockQuantity = seed.Stock,
                ProductCategory = seed.Category,
                IsWomenProduct = seed.ForWomen,
                SalesCount = seed.Sales
            };
            db.Products.Add(product);
            products.Add(seed.Name, product);
        }
        await db.SaveChangesAsync(cancellationToken);

        PackSeed[] packSeeds =
        [
            new("Pack Starter", "Les essentiels pour bien commencer.", 11900,
                ("Whey Gold Chocolat 1 kg", 1), ("Créatine Monohydrate 300 g", 1), ("Vitamine C 1000 mg", 1)),
            new("Pack Force", "Un trio complet pour les séances exigeantes.", 17900,
                ("Whey Isolate Vanille 900 g", 1), ("Créatine Monohydrate 300 g", 1), ("Pre-Workout Explosive", 1)),
            new("Pack Prise de Masse", "Nutrition et créatine pour votre objectif de masse.", 14900,
                ("Mass Gainer Vanille 3 kg", 1), ("Créatine Monohydrate 300 g", 1)),
            new("Pack Bien-être Femme", "Une sélection quotidienne dédiée aux femmes.", 8900,
                ("Collagène Marin Beauty", 1), ("Vitamine C 1000 mg", 1), ("Multivitamines Daily", 1))
        ];

        var existingPackNames = await db.Packs.Select(pack => pack.PackName).ToHashSetAsync(cancellationToken);
        foreach (var seed in packSeeds)
        {
            if (existingPackNames.Contains(seed.Name)) continue;
            db.Packs.Add(new Pack
            {
                PackName = seed.Name,
                Description = seed.Description,
                PackPriceDZD = seed.Price,
                IsActive = true,
                Items = seed.Items.Select(item => new PackItem
                {
                    ProductId = products[item.ProductName].Id,
                    Quantity = item.Quantity
                }).ToList()
            });
        }
        await db.SaveChangesAsync(cancellationToken);
    }
}
