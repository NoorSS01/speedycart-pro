import { useNavigate } from 'react-router-dom';

interface Category {
    id: string;
    name: string;
    image_url: string | null;
}

interface CategoryGridProps {
    categories: Category[];
    onCategorySelect: (categoryId: string | null) => void;
}

export default function CategoryGrid({ categories, onCategorySelect }: CategoryGridProps) {
    const navigate = useNavigate();

    if (categories.length === 0) return null;

    return (
        <div className="py-4 px-4">
            <h2 className="text-lg font-bold mb-3">Shop by Category</h2>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {categories.map((category) => (
                    <button
                        key={category.id}
                        className="flex flex-col items-center gap-2 group"
                        onClick={() => {
                            onCategorySelect(category.id);
                            navigate(`/shop?category=${category.id}`);
                        }}
                    >
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-transparent group-hover:border-primary transition-all shadow-sm group-hover:shadow-md">
                            {category.image_url ? (
                                <img
                                    src={category.image_url}
                                    alt={category.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
                                    <span className="text-2xl">🛒</span>
                                </div>
                            )}
                        </div>
                        <span className="text-xs text-center font-medium text-muted-foreground group-hover:text-primary transition-colors line-clamp-2 max-w-[70px]">
                            {category.name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
