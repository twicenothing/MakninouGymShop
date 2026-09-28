using MakninouAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace MakninouAPI.Data;

public class MakninouDBContext : DbContext
{
    public DbSet<Admin> Admins { get; set; }

    public DbSet<Product> Products { get; set; }
    public DbSet<Order> Orders { get; set; }

    public DbSet<OrderItem> OrderItems { get; set; }

    public DbSet<Pack> Packs { get; set; }

    public DbSet<PackItem> PackItems { get; set; }


    public MakninouDBContext(DbContextOptions<MakninouDBContext> options) : base(options)
    {

    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ---------- Admin ----------
        modelBuilder.Entity<Admin>().Property(a => a.Id).ValueGeneratedNever();
        modelBuilder.Entity<Admin>().Property(a => a.Username).HasMaxLength(256);
        modelBuilder.Entity<Admin>().HasIndex(a => a.Username).IsUnique();

        // ---------- Product ----------
        modelBuilder.Entity<Product>()
            .HasIndex(p => p.ProductName)
            .IsUnique();

        modelBuilder.Entity<Product>()
            .Property(p => p.ProductCategory)
            .HasConversion<string>();

        // ---------- Pack ----------
        modelBuilder.Entity<Pack>()
            .HasIndex(p => p.PackName)
            .IsUnique();

        modelBuilder.Entity<PackItem>()
            .HasOne(pi => pi.Pack)
            .WithMany(p => p.Items)
            .HasForeignKey(pi => pi.PackId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PackItem>()
            .HasOne(pi => pi.Product)
            .WithMany(p => p.Packs)
            .HasForeignKey(pi => pi.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<PackItem>()
            .HasIndex(pi => new { pi.PackId, pi.ProductId })
            .IsUnique();

        // ---------- OrderItem ----------
        modelBuilder.Entity<OrderItem>()
            .HasOne(oi => oi.Product)
            .WithMany()
            .HasForeignKey(oi => oi.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<OrderItem>()
            .HasOne(oi => oi.Pack)
            .WithMany()
            .HasForeignKey(oi => oi.PackId)
            .OnDelete(DeleteBehavior.Restrict);

        // PostgreSQL check constraint — identifiers are double-quoted
        modelBuilder.Entity<OrderItem>()
            .ToTable(t => t.HasCheckConstraint(
                "CK_OrderItem_ProductOrPack",
                "(\"ProductId\" IS NOT NULL AND \"PackId\" IS NULL) OR (\"ProductId\" IS NULL AND \"PackId\" IS NOT NULL)"));
    }
}
