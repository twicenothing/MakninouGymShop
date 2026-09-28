namespace MakninouAPI.Services;

public sealed class DuplicateProductNameException(Exception innerException)
    : Exception("A product with this name already exists.", innerException)
{
}
